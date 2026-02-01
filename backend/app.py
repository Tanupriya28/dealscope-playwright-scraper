from flask import Flask, request, jsonify
from flask_cors import CORS
import asyncio
import traceback
import logging
import re
from typing import Callable
from collections.abc import Awaitable

import os
import json
import uuid
from datetime import datetime

from scrapers import scrape_amazon, scrape_flipkart, scrape_nykaa

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Allow all frontend origins
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)


# ------------------------------------------------------
# Async helper
# ------------------------------------------------------
def run_in_new_loop(coro_factory: Callable[[], Awaitable]):
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        coro = coro_factory()
        return loop.run_until_complete(coro)
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        loop.close()


# ------------------------------------------------------
# Normalizer
# ------------------------------------------------------
def normalize_row(row):
    if not row:
        return None

    try:
        d = dict(row)
    except:
        try:
            d = row.to_dict()
        except:
            d = {}

    title = d.get("Title") or d.get("title") or ""
    price = d.get("Price") or d.get("price") or ""
    orig = d.get("OriginalPrice") or d.get("original_price") or d.get("Original Price") or ""
    url = d.get("URL") or d.get("Product Link") or d.get("link") or d.get("url")

    # ✅ keep image field from scrapers
    image = d.get("image") or d.get("img") or d.get("thumbnail")

    # discount parsing
    dp = d.get("DiscountPercent") or d.get("discount_percent") or d.get("discount")

    dp_num = None
    if isinstance(dp, (int, float)):
        dp_num = float(dp)
    else:
        try:
            m = re.search(r"(\d+(\.\d+)?)", str(dp))
            if m:
                dp_num = float(m.group(1))
        except:
            dp_num = None

    site = (d.get("site") or "").lower()
    discount_source = d.get("DiscountSource") or d.get("discount_source")

    return {
        "site": site,
        "title": title,
        "price_text": price,
        "original_price_text": orig,
        "discount_percent": dp_num,
        "discount_source": discount_source,
        "url": url,
        "image": image,  # 👈 this is what the frontend reads
    }


# ------------------------------------------------------
# ALERTS STORAGE (alerts.json)
# ------------------------------------------------------
ALERTS_FILE = os.path.join(os.path.dirname(__file__), "alerts.json")


def load_alerts():
    if not os.path.exists(ALERTS_FILE):
        return []
    try:
        with open(ALERTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        return []
    except Exception:
        logger.error("Failed to read alerts.json\n%s", traceback.format_exc())
        return []


def save_alerts(alerts):
    try:
        with open(ALERTS_FILE, "w", encoding="utf-8") as f:
            json.dump(alerts, f, ensure_ascii=False, indent=2)
    except Exception:
        logger.error("Failed to write alerts.json\n%s", traceback.format_exc())


# ------------------------------------------------------
# OPTIONS preflight
# ------------------------------------------------------
@app.route("/api/scrape", methods=["OPTIONS"])
def api_scrape_options():
    return jsonify({"ok": True}), 200


@app.route("/api/subscribe", methods=["OPTIONS"])
def api_subscribe_options():
    return jsonify({"ok": True}), 200


@app.route("/api/alerts", methods=["OPTIONS"])
def api_alerts_options():
    return jsonify({"ok": True}), 200


@app.route("/api/alerts/delete", methods=["OPTIONS"])
def api_alerts_delete_options():
    return jsonify({"ok": True}), 200


# ------------------------------------------------------
# MAIN SCRAPE ROUTE
# ------------------------------------------------------
@app.route("/api/scrape", methods=["POST"])
def api_scrape():
    try:
        payload = request.get_json(force=True) or {}
        keyword = payload.get("keyword", "laptop")
        max_products = int(payload.get("max_products", 12))

        logger.info("Incoming /api/scrape payload: %r", payload)

        def factory():
            return asyncio.gather(
                scrape_amazon(keyword=keyword, max_products=max_products),
                scrape_flipkart(keyword=keyword, max_products=max_products),
                scrape_nykaa(keyword=keyword, max_products=max_products),
                return_exceptions=True,
            )

        gathered = run_in_new_loop(factory)

        combined = []
        site_errors = {}
        site_names = ["amazon", "flipkart", "nykaa"]

        for site_name, res in zip(site_names, gathered):
            if isinstance(res, Exception):
                site_errors[site_name] = str(res)
                continue

            for r in res:
                nr = normalize_row(r)
                if nr:
                    if not nr["site"]:
                        nr["site"] = site_name
                    combined.append(nr)

        # ------------------------------------------------------
        # SIMPLE DISCOUNT FILTER:
        # Expect payload["discount"] = 30 (or "30" or "30%")
        # Keep only items with discount_percent <= discount
        # ------------------------------------------------------
        raw_discount = payload.get("discount")

        if raw_discount not in (None, "", 0, "0"):
            try:
                m = re.search(r"\d+(\.\d+)?", str(raw_discount))
                if m:
                    max_discount = float(m.group(0))
                    logger.info("Applying discount filter: <= %.2f%%", max_discount)
                    combined = [
                        item
                        for item in combined
                        if item.get("discount_percent") is not None
                        and item["discount_percent"] <= max_discount
                    ]
                else:
                    logger.info("No numeric discount found in %r, skipping filter", raw_discount)
            except Exception:
                logger.error("Failed to parse discount from %r\n%s", raw_discount, traceback.format_exc())
        else:
            logger.info("No discount filter value provided; returning all items.")

        return jsonify({
            "success": True,
            "keyword": keyword,
            "count_all": len(combined),
            "site_errors": site_errors,
            "items": combined
        })

    except Exception as e:
        logger.error("Scrape error: %s", traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500


# ------------------------------------------------------
# SUBSCRIBE: create alert in alerts.json
# ------------------------------------------------------
@app.route("/api/subscribe", methods=["POST"])
def api_subscribe():
    try:
        payload = request.get_json(force=True) or {}

        product = payload.get("product") or {}
        keyword = payload.get("keyword") or ""
        discount = payload.get("discount") or ""
        method = payload.get("method") or "Email"
        contact = payload.get("contact") or ""

        if not contact:
            return jsonify({"success": False, "error": "Contact is required"}), 400

        alerts = load_alerts()

        alert = {
            "id": str(uuid.uuid4()),
            "keyword": keyword,
            "discount": discount,
            "method": method,
            "contact": contact,
            "product_title": product.get("title") or product.get("name") or keyword,
            "product_url": product.get("url"),
            "site": product.get("site"),
            "created_at": datetime.utcnow().isoformat() + "Z"
        }

        alerts.append(alert)
        save_alerts(alerts)

        return jsonify({"success": True, "alert": alert})

    except Exception as e:
        logger.error("Subscribe error: %s", traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500


# ------------------------------------------------------
# LIST ALERTS
# ------------------------------------------------------
@app.route("/api/alerts", methods=["GET"])
def api_get_alerts():
    try:
        alerts = load_alerts()
        return jsonify({"success": True, "alerts": alerts})
    except Exception as e:
        logger.error("Get alerts error: %s", traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500


# ------------------------------------------------------
# DELETE ALERT
# ------------------------------------------------------
@app.route("/api/alerts/delete", methods=["POST"])
def api_delete_alert():
    try:
        payload = request.get_json(force=True) or {}
        alert_id = payload.get("id")
        if not alert_id:
            return jsonify({"success": False, "error": "id is required"}), 400

        alerts = load_alerts()
        new_alerts = [a for a in alerts if a.get("id") != alert_id]
        deleted = len(alerts) - len(new_alerts)

        save_alerts(new_alerts)

        return jsonify({"success": True, "deleted": deleted})
    except Exception as e:
        logger.error("Delete alert error: %s", traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500


# ------------------------------------------------------
# Run server
# ------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
