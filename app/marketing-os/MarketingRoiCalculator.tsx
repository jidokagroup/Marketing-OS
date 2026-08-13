"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const PLATFORM_COST = 297;

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="marketing-roi-slider-card block rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-[#101828]">{label}</span>
        <span className="marketing-roi-value-pill font-data rounded-full bg-[#F4F3FF] px-3 py-1 text-sm font-semibold text-[#432DD7]">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-4 w-full accent-[#5659F0]"
      />
    </label>
  );
}

export default function MarketingRoiCalculator() {
  const [hoursPerClient, setHoursPerClient] = useState(10);
  const [hourlyValue, setHourlyValue] = useState(65);
  const [clientCount, setClientCount] = useState(12);
  const [monthlyClientValue, setMonthlyClientValue] = useState(2500);
  const [referrals, setReferrals] = useState(1);
  const [referralValue, setReferralValue] = useState(700);

  const totals = useMemo(() => {
    const timeValue = hoursPerClient * clientCount * hourlyValue;
    const retentionValue = clientCount * monthlyClientValue;
    const referralUpside = referrals * referralValue;
    const grossUpside = timeValue + retentionValue + referralUpside;
    return {
      timeValue,
      retentionValue,
      referralUpside,
      grossUpside,
      netUpside: Math.max(grossUpside - PLATFORM_COST, 0),
    };
  }, [hoursPerClient, hourlyValue, clientCount, monthlyClientValue, referrals, referralValue]);

  return (
    <div className="marketing-roi-calculator rounded-[1.5rem] border bg-white p-5 shadow-[0_24px_70px_rgba(13,15,46,0.08)] sm:p-6 lg:p-8" style={{ borderColor: "rgba(86,89,240,0.16)" }}>
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5659F0]">ROI calculator</p>
          <h3 className="mt-3 text-3xl font-bold leading-tight text-[#101828]">Lock in $297/month or $3,267/year.</h3>
          <p className="mt-3 text-sm leading-relaxed text-[#4A5565]">
            Start with a 7-day free trial. Prefer annual? Get 1 month free.
          </p>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <SliderField label="Hours spent per client on average (monthly)" value={hoursPerClient} min={1} max={100} suffix="h" onChange={setHoursPerClient} />
            <SliderField label="Hourly value of team time" value={hourlyValue} min={12} max={200} step={1} suffix="/h" onChange={setHourlyValue} />
            <SliderField label="Number of clients" value={clientCount} min={1} max={300} suffix="" onChange={setClientCount} />
            <SliderField label="Average monthly client value" value={monthlyClientValue} min={500} max={15000} step={250} suffix="" onChange={setMonthlyClientValue} />
            <SliderField label="Eligible partner referrals" value={referrals} min={0} max={5} suffix="" onChange={setReferrals} />
            <SliderField label="Referral value estimate" value={referralValue} min={100} max={5000} step={100} suffix="" onChange={setReferralValue} />
          </div>
        </div>

        <div className="marketing-roi-summary rounded-[1.25rem] bg-[#0F172B] p-5 text-white sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A78BFA]">Estimated monthly upside</p>
          <p className="font-data mt-4 text-5xl font-bold tracking-tight sm:text-6xl">{currency(totals.netUpside)}</p>
          <p className="mt-2 text-sm text-white/65">after the $297/month platform cost</p>

          <div className="mt-6 grid gap-3">
            {[
              ["Client production time value", totals.timeValue],
              ["Client value represented", totals.retentionValue],
              ["Referral upside", totals.referralUpside],
              ["Platform cost", -PLATFORM_COST],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 rounded-xl bg-white/8 px-4 py-3 text-sm">
                <span className="text-white/72">{label}</span>
                <strong className="font-data">{currency(Number(value))}</strong>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/12 bg-white/8 p-4">
            <p className="text-lg font-semibold leading-snug">
              What would you do if you made an extra {currency(totals.netUpside)} every month?
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-[#0F172B] transition hover:bg-[#F4F3FF]">
              Lock Founder Pricing + 7-Day Trial
            </Link>
            <Link href="https://jidokagroup.com/book/schedule" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/18 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Schedule a Call
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
