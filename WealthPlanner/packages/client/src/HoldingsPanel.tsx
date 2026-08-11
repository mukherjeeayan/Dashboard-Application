// Direct Holdings screen (docs/09 §9.1, docs/06 §6.1/§6.9). For a
// MARKET_LINKED_DIRECT / DIGITAL_ASSET account: buy lots, update the latest
// per-ticker price, sell (FIFO across lots, realized gain/tax computed by the
// engine), and record yield income. The account's balance always equals
// Σ remaining quantity × latest price.

import { useCallback, useEffect, useState } from "react";
import { api, type HoldingsSummary } from "./api";
import { formatMoney } from "./format";

export function HoldingsPanel({
  planId,
  accountId,
  label,
  currency,
  locale = "en-IN",
}: {
  planId: string;
  accountId: string;
  label: string;
  currency: string;
  locale?: string;
}) {
  const [summary, setSummary] = useState<HoldingsSummary | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Buy form
  const [ticker, setTicker] = useState("");
  const [qty, setQty] = useState("");
  const [acqDate, setAcqDate] = useState("");
  const [acqPrice, setAcqPrice] = useState("");

  // Sell form
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellDate, setSellDate] = useState("");
  const [sellResult, setSellResult] = useState<{
    totalGain: number;
    totalTax: number;
  } | null>(null);

  // Price form
  const [priceTicker, setPriceTicker] = useState("");
  const [priceDate, setPriceDate] = useState("");
  const [priceValue, setPriceValue] = useState("");

  // Yield form
  const [yieldDate, setYieldDate] = useState("");
  const [yieldAmount, setYieldAmount] = useState("");
  const [yieldDesc, setYieldDesc] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    const data = await api.getHoldings(planId, accountId);
    setSummary(data);
    setTicker((t) => t || Object.keys(data.latestPrices)[0] || "");
    setPriceTicker((t) => t || Object.keys(data.latestPrices)[0] || "");
  }, [planId, accountId]);

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [load]);

  const clear = () => {
    setMsg(null);
    setErr(null);
  };

  const buy = async () => {
    clear();
    await api.buyLot(planId, accountId, {
      ticker,
      quantity: Number(qty),
      acquisitionDate: acqDate,
      acquisitionPricePerUnit: Number(acqPrice),
    });
    setQty("");
    setAcqDate("");
    setAcqPrice("");
    setMsg("Lot recorded.");
    await load();
  };

  const sell = async () => {
    clear();
    const data = await api.sell(planId, accountId, {
      date: sellDate,
      quantity: Number(sellQty),
      pricePerUnit: Number(sellPrice),
    });
    setSellResult({ totalGain: data.totalGain, totalTax: data.totalTax });
    setSellQty("");
    setMsg("Sale recorded.");
    await load();
  };

  const updatePrice = async () => {
    clear();
    await api.updatePrice(planId, accountId, {
      ticker: priceTicker,
      asOfDate: priceDate,
      pricePerUnit: Number(priceValue),
    });
    setPriceDate("");
    setPriceValue("");
    setMsg("Price updated.");
    await load();
  };

  const recordYield = async () => {
    clear();
    await api.recordYield(planId, accountId, {
      date: yieldDate,
      amount: Number(yieldAmount),
      description: yieldDesc || undefined,
    });
    setYieldDate("");
    setYieldAmount("");
    setYieldDesc("");
    setMsg("Yield recorded.");
    await load();
  };

  const fmt = (v: number) => formatMoney(v, currency, locale);

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Holdings — {label}</h3>
      </div>

      {err && <p className="error">{err}</p>}
      {msg && <p className="muted">{msg}</p>}

      {summary && (
        <>
          <p className="muted">
            Account value {fmt(summary.currentValue)} across {summary.lots.length} lot
            {summary.lots.length === 1 ? "" : "s"}.
          </p>

          <table className="table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="num">Bought</th>
                <th className="num">Remaining</th>
                <th className="num">Cost/unit</th>
                <th className="num">Latest price</th>
              </tr>
            </thead>
            <tbody>
              {summary.lots.map((lot) => (
                <tr key={lot.id}>
                  <td>{lot.ticker}</td>
                  <td className="num">{lot.quantity}</td>
                  <td className="num">{lot.remainingQuantity}</td>
                  <td className="num">{lot.acquisitionPricePerUnit}</td>
                  <td className="num">
                    {summary.latestPrices[lot.ticker] ?? <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
              {summary.lots.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No lots yet. Record a purchase below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h4 style={{ marginTop: "1rem" }}>Buy</h4>
          <div className="row">
            <input className="input" placeholder="Ticker" aria-label="Buy ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} style={{ width: 110 }} />
            <input className="input" type="number" placeholder="Quantity" aria-label="Buy quantity" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 110 }} />
            <input className="input" type="date" aria-label="Buy date" value={acqDate} onChange={(e) => setAcqDate(e.target.value)} style={{ width: 150 }} />
            <input className="input" type="number" placeholder="Cost/unit" aria-label="Buy cost per unit" value={acqPrice} onChange={(e) => setAcqPrice(e.target.value)} style={{ width: 110 }} />
            <button onClick={buy} className="btn">Buy</button>
          </div>

          <h4 style={{ marginTop: "1rem" }}>Sell</h4>
          <div className="row">
            <input className="input" type="date" aria-label="Sell date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} style={{ width: 150 }} />
            <input className="input" type="number" placeholder="Quantity" aria-label="Sell quantity" value={sellQty} onChange={(e) => setSellQty(e.target.value)} style={{ width: 110 }} />
            <input className="input" type="number" placeholder="Price/unit" aria-label="Sell price per unit" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} style={{ width: 110 }} />
            <button onClick={sell} className="btn">Sell</button>
          </div>
          {sellResult && (
            <p className="muted">
              Realized gain {fmt(sellResult.totalGain)}, tax {fmt(sellResult.totalTax)}.
            </p>
          )}

          <h4 style={{ marginTop: "1rem" }}>Update price</h4>
          <div className="row">
            <input className="input" placeholder="Ticker" aria-label="Price ticker" value={priceTicker} onChange={(e) => setPriceTicker(e.target.value)} style={{ width: 110 }} />
            <input className="input" type="date" aria-label="Price date" value={priceDate} onChange={(e) => setPriceDate(e.target.value)} style={{ width: 150 }} />
            <input className="input" type="number" placeholder="Price/unit" aria-label="Price per unit" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} style={{ width: 110 }} />
            <button onClick={updatePrice} className="btn">Update price</button>
          </div>

          <h4 style={{ marginTop: "1rem" }}>Yield income</h4>
          <div className="row">
            <input className="input" type="date" aria-label="Yield date" value={yieldDate} onChange={(e) => setYieldDate(e.target.value)} style={{ width: 150 }} />
            <input className="input" type="number" placeholder="Amount" aria-label="Yield amount" value={yieldAmount} onChange={(e) => setYieldAmount(e.target.value)} style={{ width: 110 }} />
            <input className="input" placeholder="Description" aria-label="Yield description" value={yieldDesc} onChange={(e) => setYieldDesc(e.target.value)} style={{ width: 160 }} />
            <button onClick={recordYield} className="btn">Record yield</button>
          </div>

          {summary.yieldEntries.length > 0 && (
            <>
              <h4 style={{ marginTop: "1rem" }}>Yield history</h4>
              <ul className="plain-list">
                {summary.yieldEntries.map((y) => (
                  <li key={y.id} className="muted">
                    {y.date}: {fmt(y.amount)}
                    {y.description ? ` — ${y.description}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
