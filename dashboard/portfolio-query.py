import sqlite3, json, sys

DB = "/home/rooot/.openclaw/data/tougu.db"

def get_summary():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    accounts = conn.execute("SELECT * FROM bot_accounts").fetchall()
    result = []
    for a in accounts:
        bot_id = a["bot_id"]
        holdings = conn.execute(
            "SELECT h.product_id, h.amount_invested, h.market_value, h.weight, h.role, "
            "h.unrealized_pnl, h.unrealized_pnl_pct, h.latest_nav, h.entry_nav, "
            "i.strategy_name "
            "FROM bot_holdings h LEFT JOIN tougu_info i ON h.product_id = i.strategy_id "
            "WHERE h.bot_id = ? AND h.status = 'active' ORDER BY h.market_value DESC",
            (bot_id,),
        ).fetchall()
        snap = conn.execute(
            "SELECT * FROM bot_daily_snapshots WHERE bot_id = ? ORDER BY trade_date DESC LIMIT 1",
            (bot_id,),
        ).fetchone()
        result.append({
            "bot_id": bot_id,
            "initial_capital": a["initial_capital"],
            "cash": a["cash"],
            "total_value": snap["total_value"] if snap else a["initial_capital"],
            "net_value": snap["net_value"] if snap else 1.0,
            "cumulative_return_pct": snap["cumulative_return_pct"] if snap else 0,
            "daily_return_pct": snap["daily_return_pct"] if snap else 0,
            "max_drawdown": snap["max_drawdown"] if snap else 0,
            "trade_date": snap["trade_date"] if snap else None,
            "holdings": [
                {
                    "product_id": h["product_id"],
                    "product_name": h["strategy_name"] or h["product_id"],
                    "amount": h["amount_invested"],
                    "market_value": h["market_value"],
                    "weight": h["weight"],
                    "role": h["role"],
                    "pnl": h["unrealized_pnl"],
                    "pnl_pct": h["unrealized_pnl_pct"],
                }
                for h in holdings
            ],
        })
    conn.close()
    return result

def get_details():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    # All holdings (active + closed, excluding CASH)
    holdings = conn.execute(
        "SELECT h.bot_id, h.product_id, h.weight, h.role, h.thesis, h.status, "
        "h.entry_date, h.exit_date, h.unrealized_pnl, h.unrealized_pnl_pct, "
        "h.amount_invested, h.market_value, "
        "COALESCE(i.strategy_name, h.product_id) as product_name "
        "FROM bot_holdings h LEFT JOIN tougu_info i ON h.product_id = i.strategy_id "
        "WHERE h.product_id != 'CASH' "
        "ORDER BY h.bot_id, CASE h.status WHEN 'active' THEN 0 ELSE 1 END, h.weight DESC"
    ).fetchall()
    # Net value time-series
    snapshots = conn.execute(
        "SELECT bot_id, trade_date, net_value, cumulative_return_pct, "
        "daily_return_pct, total_value, cash, max_drawdown "
        "FROM bot_daily_snapshots ORDER BY bot_id, trade_date"
    ).fetchall()
    # Account info
    accounts = {a["bot_id"]: dict(a) for a in
        conn.execute("SELECT * FROM bot_accounts").fetchall()}
    conn.close()

    result = {}
    for h in holdings:
        bid = h["bot_id"]
        if bid not in result:
            result[bid] = {"holdings": [], "snapshots": [], "account": accounts.get(bid, {})}
        result[bid]["holdings"].append({
            "product_id": h["product_id"],
            "product_name": h["product_name"],
            "weight": h["weight"],
            "role": h["role"],
            "thesis": h["thesis"],
            "status": h["status"],
            "entry_date": h["entry_date"],
            "exit_date": h["exit_date"],
            "pnl": h["unrealized_pnl"],
            "pnl_pct": h["unrealized_pnl_pct"],
            "amount": h["amount_invested"],
            "market_value": h["market_value"],
        })
    for s in snapshots:
        bid = s["bot_id"]
        if bid not in result:
            result[bid] = {"holdings": [], "snapshots": [], "account": accounts.get(bid, {})}
        result[bid]["snapshots"].append({
            "date": s["trade_date"],
            "nav": s["net_value"],
            "return_pct": s["cumulative_return_pct"],
            "total_value": s["total_value"],
            "cash": s["cash"],
            "max_drawdown": s["max_drawdown"],
        })
    return result

BENCHMARKS = {
    "000001.SH": {"source": "index", "name": "上证指数"},
    "518880.SH": {"source": "fund",  "name": "黄金ETF"},
}

def _fetch_ohlc(code, source, start, end):
    import sys as _sys
    _sys.path.insert(0, "/home/rooot/MCP/hq")
    if source == "fund":
        from finance_data import get_fund_daily
        return get_fund_daily(ts_code=code, start_date=start, end_date=end)
    else:
        from finance_data import get_index_daily
        return get_index_daily(code, start, end)

def get_benchmarks():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    dates = [r["trade_date"] for r in conn.execute(
        "SELECT DISTINCT trade_date FROM bot_daily_snapshots ORDER BY trade_date"
    ).fetchall()]
    conn.close()
    if not dates:
        return {}

    start = dates[0].replace("-", "")
    end = dates[-1].replace("-", "")
    result = {}

    for code, cfg in BENCHMARKS.items():
        try:
            df = _fetch_ohlc(code, cfg["source"], start, end)
            if df is None or df.empty:
                result[code] = []
                continue
            series = []
            for _, row in df.iterrows():
                d = str(row["trade_date"])
                date_str = f"{d[:4]}-{d[4:6]}-{d[6:8]}"
                item = {"date": date_str, "close": float(row["close"])}
                for k in ("open", "high", "low"):
                    if k in row and row[k] is not None:
                        item[k] = float(row[k])
                series.append(item)
            series.sort(key=lambda x: x["date"])
            if series:
                base = series[0]["close"]
                for r in series:
                    r["return_pct"] = (r["close"] / base - 1) * 100
            result[code] = series
        except Exception as e:
            result[code] = [{"error": str(e)}]

    return result

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--details":
        print(json.dumps(get_details(), ensure_ascii=False))
    elif len(sys.argv) > 1 and sys.argv[1] == "--benchmarks":
        print(json.dumps(get_benchmarks(), ensure_ascii=False))
    else:
        print(json.dumps(get_summary(), ensure_ascii=False))
