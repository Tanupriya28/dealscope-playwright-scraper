# scrapers.py
import asyncio
import logging
import re
import html as html_unescape
from urllib.parse import urljoin, urlparse, unquote

from playwright.async_api import async_playwright, Error as PlaywrightError
from fake_useragent import UserAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --------------------
# Helpers
# --------------------
def make_absolute_url(base: str, href: str):
    if not href:
        return None
    h = href.strip()
    if h.startswith("//"):
        return "https:" + h
    parsed = urlparse(h)
    if parsed.scheme and parsed.netloc:
        return h
    return urljoin(base, h)


def parse_price_to_number(price):
    if not price:
        return None
    s = str(price).replace("\u00a0", " ").replace(",", "")
    s = re.sub(r"[^\d.\-]", "", s)
    try:
        return float(s)
    except Exception:
        return None


def normalize_display_price(price_text: str) -> str:
    """
    Return only the numeric part like '35,490'.
    UI should prepend '₹'.
    Always returns a string ('N/A' as fallback).
    """
    if not price_text:
        return "N/A"
    s = str(price_text).replace("\u00a0", " ")
    m = re.search(r"([\d,]+(?:\.\d+)?)", s)
    if not m:
        return "N/A"
    return m.group(1)


def _sanitize_discount(discount_percent, price_text, orig_text):
    """
    Keep discount_percent realistic (0–95%).
    If missing or >95, try to recompute from price/original.
    Returns float or None.
    """
    if discount_percent is None:
        pnum = parse_price_to_number(price_text)
        onum = parse_price_to_number(orig_text)
        if onum and pnum and onum > 0 and onum > pnum:
            try:
                discount_percent = round(((onum - pnum) / onum) * 100, 2)
            except Exception:
                discount_percent = None

    if discount_percent is None:
        return None

    if 0 <= discount_percent <= 95:
        return discount_percent

    # last try recompute
    pnum = parse_price_to_number(price_text)
    onum = parse_price_to_number(orig_text)
    if onum and pnum and onum > 0 and onum > pnum:
        try:
            recomputed = round(((onum - pnum) / onum) * 100, 2)
            if 0 <= recomputed <= 95:
                return recomputed
        except Exception:
            pass

    return None


async def _navigate_with_retries(page, url, max_attempts=3, timeout=90000, wait_until="domcontentloaded"):
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            await page.goto(url, timeout=timeout, wait_until=wait_until)
            await asyncio.sleep(0.6)
            return
        except PlaywrightError as e:
            last_exc = e
            logger.warning("Navigation attempt %d failed for %s: %s", attempt, url, repr(e))
            if attempt < max_attempts:
                await asyncio.sleep(1.5 * attempt)
                continue
            raise last_exc


async def _close_possible_popup_selectors(page, selectors):
    for sel in selectors:
        try:
            await page.click(sel, timeout=2000)
            await asyncio.sleep(0.5)
        except Exception:
            continue


# ------------------------------------------------------------------
# AMAZON – fixed image handling (scroll + placeholder filtering)
# ------------------------------------------------------------------
async def scrape_amazon(keyword="laptop", max_products=10, max_pages=2, headless=False):
    ua = UserAgent()
    results = []
    base = "https://www.amazon.in"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            user_agent=ua.random,
            viewport={"width": 1280, "height": 900},
            java_script_enabled=True,
            locale="en-IN",
        )
        page = await context.new_page()

        page_num = 1

        try:
            while len(results) < max_products and page_num <= max_pages:
                url = f"{base}/s?k={keyword.replace(' ', '+')}&page={page_num}"
                logger.info("Amazon (search) -> %s", url)

                await page.goto(url, timeout=90000)
                await page.wait_for_load_state("networkidle")

                # ---- FORCE FULL PAGE SCROLL TO LOAD LAZY IMAGES ----
                for _ in range(20):
                    await page.mouse.wheel(0, 2000)
                    await asyncio.sleep(0.4)

                items = await page.query_selector_all("div.s-result-item[data-component-type='s-search-result']")
                if not items:
                    break

                for item in items:
                    if len(results) >= max_products:
                        break

                    try:
                        # Scroll each item into view
                        try:
                            await item.scroll_into_view_if_needed()
                            await asyncio.sleep(0.2)
                        except:
                            pass

                        # ----- TITLE -----
                        title_el = await item.query_selector("h2 a span")
                        title = (await title_el.inner_text()).strip() if title_el else None
                        if not title:
                            continue

                        # ----- URL -----
                        link_el = await item.query_selector("h2 a")
                        href = await link_el.get_attribute("href") if link_el else None
                        url_link = make_absolute_url(base, href)

                        # ----- IMAGE -----
                        image_url = None
                        img_el = await item.query_selector("img.s-image")
                        if img_el:
                            for attr in ("src", "data-image-src", "srcset", "data-src"):
                                v = await img_el.get_attribute(attr)
                                if not v:
                                    continue
                                if "srcset" in attr:
                                    v = v.split(",")[0].strip().split(" ")[0]
                                image_url = v
                                break

                        # Convert to absolute
                        if image_url:
                            image_url = make_absolute_url(base, image_url)

                        # ---- AMAZON PLACEHOLDER DETECTION ----
                        if image_url:
                            low = image_url.lower()
                            if (
                                "placeholder" in low or
                                "transparent" in low or
                                "pixel" in low or
                                "no-image" in low or
                                "sprite" in low or
                                "ux-sprite" in low
                            ):
                                image_url = None

                        # ----- PRICE -----
                        price_el = await item.query_selector("span.a-price > span.a-offscreen")
                        price_raw = (await price_el.inner_text()).strip() if price_el else None

                        orig_el = await item.query_selector("span.a-text-price span.a-offscreen")
                        orig_raw = (await orig_el.inner_text()).strip() if orig_el else None

                        # Discount
                        discount = None
                        disc_el = await item.query_selector("span.savingsPercentage")
                        if disc_el:
                            text = await disc_el.inner_text()
                            m = re.search(r"(\d+)", text)
                            if m:
                                discount = float(m.group(1))

                        # Normalize
                        out_price = normalize_display_price(price_raw)
                        out_orig = normalize_display_price(orig_raw)

                        if out_price == "N/A" and out_orig != "N/A":
                            out_price = out_orig
                        if out_orig == "N/A" and out_price != "N/A":
                            out_orig = out_price

                        discount = discount or 0.0

                        results.append({
                            "site": "amazon",
                            "Title": title,
                            "Price": out_price,
                            "OriginalPrice": out_orig,
                            "DiscountPercent": discount,
                            "DiscountSource": "scraped" if discount else "none",
                            "URL": url_link,
                            "image": image_url,  # if None → frontend shows dummy
                        })

                    except Exception as e:
                        logger.debug("Amazon item error: %s", e)
                        continue

                page_num += 1

        finally:
            await page.close()
            await context.close()
            await browser.close()

    logger.info("Amazon scraped %d items", len(results))
    return results


# ------------------------------------------------------------------
# FLIPKART – same as your working version
# ------------------------------------------------------------------
async def scrape_flipkart(keyword="laptop", max_products=24, max_pages=5, headless=False):
    """
    Flipkart scraper using the SAME environment as your working script:
      - NO fake UA
      - NO custom viewport
      - NO custom headers
      - Uses div[data-id] selectors
      - Scroll + regex extraction
    """

    results = []
    base = "https://www.flipkart.com"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context()
        page = await context.new_page()

        page_number = 1

        try:
            while len(results) < max_products and page_number <= max_pages:

                url = f"{base}/search?q={keyword}&page={page_number}"
                logger.info("Flipkart (search) -> %s", url)
                await page.goto(url, timeout=90000)

                # Close popup
                try:
                    await page.wait_for_selector("button:has-text('✕')", timeout=4000)
                    await page.click("button:has-text('✕')")
                    logger.info("Closed login popup")
                except:
                    pass

                # Scroll like your script
                for _ in range(12):
                    await page.mouse.wheel(0, 2000)
                    await asyncio.sleep(0.7)

                product_cards = await page.query_selector_all("div[data-id]")
                logger.info("Flipkart: found %d product containers on page %d",
                            len(product_cards), page_number)

                for card in product_cards:
                    if len(results) >= max_products:
                        break

                    html = await card.inner_html()

                    # ----- IMAGE -----
                    image_url = None
                    img_el = await card.query_selector("img")
                    if img_el:
                        image_url = await img_el.get_attribute("src")
                        if (not image_url) or image_url.startswith("data:"):
                            image_url = await img_el.get_attribute("data-src")
                    if image_url:
                        image_url = make_absolute_url(base, image_url)

                    # TITLE
                    m = re.findall(r'>([^<>]{10,120})<', html)
                    title = None
                    if m:
                        candidates = [
                            t.strip()
                            for t in m
                            if not re.search(r'₹|%|★|off|Add to Cart', t, re.I)
                        ]
                        title = max(candidates, key=len) if candidates else None

                    # PRICE
                    price_match = re.search(r'₹\s?[\d,]+', html)
                    price_raw = price_match.group(0) if price_match else None

                    # DISCOUNT
                    disc_match = re.search(r'(\d{1,2})%\s*off', html, re.I)
                    discount = int(disc_match.group(1)) if disc_match else None

                    # ORIGINAL
                    orig_raw = None
                    pnum = parse_price_to_number(price_raw)
                    if pnum and discount:
                        try:
                            orig_val = round(pnum * 100 / (100 - discount))
                            orig_raw = f"{orig_val:,}"
                        except:
                            pass

                    # URL
                    link = await card.query_selector("a")
                    href = await link.get_attribute("href") if link else None

                    url_link = None
                    if href:
                        href = unquote(href)
                        if href.startswith("/"):
                            href = href.split("?")[0]
                            url_link = urljoin(base, href)
                        elif href.startswith("http"):
                            url_link = href

                    if not title or not price_raw:
                        continue

                    results.append({
                        "site": "flipkart",
                        "Title": title,
                        "Price": normalize_display_price(price_raw),
                        "OriginalPrice": normalize_display_price(orig_raw),
                        "DiscountPercent": float(discount) if discount else 0.0,
                        "DiscountSource": "scraped_badge" if discount else "none",
                        "URL": url_link,
                        "image": image_url,
                    })

                logger.info("Flipkart: extracted %d items so far", len(results))
                page_number += 1

        finally:
            await page.close()
            await context.close()
            await browser.close()

    logger.info("Flipkart scraped %d items (final)", len(results))
    return results


# ------------------------------------------------------------------
# NYKAA – same working version (with image handling)
# ------------------------------------------------------------------
async def scrape_nykaa(keyword="lipstick", max_products=20, max_pages=3, headless=False):
    """
    Nykaa scraper adapted directly from your working notebook version,
    but returning the unified backend format, now including image.

    Image strategy:
      1) Try img src / data-src / srcset on the listing card.
      2) If still missing, open the product URL and read og:image.
    """
    results = []
    base = "https://www.nykaa.com"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context()   # default UA & viewport
        page = await context.new_page()

        try:
            page_num = 1
            while len(results) < max_products and page_num <= max_pages:
                url = f"{base}/search/result/?q={keyword}&page_no={page_num}"
                logger.info("Nykaa (search) -> %s", url)
                await page.goto(url, timeout=90000)
                await asyncio.sleep(6)  # let JS render, same as your script

                # Scroll to load all items
                for _ in range(10):
                    await page.mouse.wheel(0, 2000)
                    await asyncio.sleep(1)

                product_cards = await page.query_selector_all("div.css-1rd7vky")
                logger.info("Nykaa: found %d products on page %d", len(product_cards), page_num)

                for card in product_cards:
                    if len(results) >= max_products:
                        break

                    try:
                        # --- Product Link first (needed for image fallback) ---
                        link_el = await card.query_selector("a[href]")
                        href = await link_el.get_attribute("href") if link_el else None

                        if not href:
                            parent = await card.query_selector("xpath=ancestor::a")
                            if parent:
                                href = await parent.get_attribute("href")

                        url_link = urljoin(base, href.strip()) if href else None

                        # --- IMAGE from listing ---
                        img_url = None
                        img_el = await card.query_selector("img")
                        if img_el:
                            for attr in ("src", "data-src", "data-srcset", "srcset"):
                                val = await img_el.get_attribute(attr)
                                if not val:
                                    continue
                                if "srcset" in attr:
                                    first = val.split(",")[0].strip().split(" ")[0]
                                    val = first
                                img_url = val
                                if img_url:
                                    break

                        if img_url:
                            img_url = make_absolute_url(base, img_url)

                        # --- Fallback: open product page & read og:image ---
                        if (not img_url) and url_link:
                            try:
                                detail_page = await context.new_page()
                                await detail_page.goto(url_link, timeout=90000)
                                og = await detail_page.query_selector('meta[property="og:image"]')
                                if og:
                                    ogc = await og.get_attribute("content")
                                    if ogc:
                                        img_url = make_absolute_url(base, ogc.strip())
                            except Exception:
                                pass
                            finally:
                                try:
                                    await detail_page.close()
                                except Exception:
                                    pass

                        # --- Title ---
                        title_el = await card.query_selector("div.css-xrzmfa")
                        title = await title_el.inner_text() if title_el else None

                        # --- Price (selling) ---
                        price_el = await card.query_selector("span.css-111z9ua")
                        price_raw = await price_el.inner_text() if price_el else None

                        # --- Original Price (MRP) ---
                        orig_el = await card.query_selector("span.css-17x46n5")
                        orig_raw = await orig_el.inner_text() if orig_el else None

                        # --- Discount ---
                        disc_el = await card.query_selector("span.css-cjd9an")
                        discount_text = await disc_el.inner_text() if disc_el else None
                        discount = int(re.search(r'(\d+)', discount_text).group(1)) if discount_text else None

                        # Skip if no title or no price (invalid card)
                        if not title or not price_raw:
                            continue

                        out_title = title.strip()
                        out_price = normalize_display_price(price_raw.strip())
                        if orig_raw:
                            out_orig = normalize_display_price(orig_raw.strip())
                        else:
                            out_orig = "N/A"

                        # If we have discount but no original, approximate original
                        if out_orig == "N/A" and discount is not None:
                            pnum = parse_price_to_number(out_price)
                            if pnum is not None and 0 < discount < 95:
                                try:
                                    orig_val = round(pnum * 100 / (100 - discount))
                                    out_orig = f"{orig_val:,}"
                                except Exception:
                                    pass

                        discount_percent = float(discount) if discount is not None else 0.0
                        discount_source = "scraped_badge" if discount is not None else "none"

                        results.append(
                            {
                                "site": "nykaa",
                                "Title": out_title,
                                "Price": out_price,
                                "OriginalPrice": out_orig,
                                "DiscountPercent": discount_percent,
                                "DiscountSource": discount_source,
                                "URL": url_link,
                                "image": img_url,
                            }
                        )

                    except Exception as e:
                        logger.debug("Nykaa parse err: %s", e)
                        continue

                logger.info("Nykaa: extracted %d items so far...", len(results))
                page_num += 1

        finally:
            try:
                await page.close()
            except Exception:
                pass
            try:
                await context.close()
            except Exception:
                pass
            await browser.close()

    logger.info("Nykaa scraped %d items (final)", len(results))
    return results
