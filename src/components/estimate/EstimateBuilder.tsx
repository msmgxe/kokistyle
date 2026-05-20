"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Download, Plus, Printer, QrCode, Trash2 } from "lucide-react";

import { branding } from "@/src/config/branding";
import { useLanguage } from "@/src/context/LanguageContext";
import Button from "../ui/Button";
import Container from "../ui/Container";

interface EstimateFormValues {
  clientName: string;
  clientEmail: string;
  projectType: string;
  propertyCity: string;
  notes: string;
}

interface EstimateItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function EstimateBuilder() {
  const { t } = useLanguage();
  const createInitialItems = () =>
    t.estimate.initialItems.map((description, index) => ({
      id: index + 1,
      description,
      quantity: 1,
      unitPrice: index === 0 ? 750 : 8500,
    }));

  const [items, setItems] = useState<EstimateItem[]>(createInitialItems);
  const [qrPreview, setQrPreview] = useState("");
  const { register, getValues } = useForm<EstimateFormValues>({
    defaultValues: t.estimate.defaults,
  });

  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.quantity * item.unitPrice, 0),
    [items],
  );
  const contingency = subtotal * 0.1;
  const total = subtotal + contingency;

  const updateItem = (
    id: number,
    field: keyof Omit<EstimateItem, "id">,
    value: string,
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === "description"
                  ? value
                  : Number.isFinite(Number(value))
                    ? Number(value)
                    : 0,
            }
          : item,
      ),
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        id: Date.now(),
        description: t.estimate.newScopeItem,
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const removeItem = (id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const buildQrPayload = () => {
    const values = getValues();

    return JSON.stringify({
      company: branding.companyName,
      client: values.clientName,
      projectType: values.projectType,
      city: values.propertyCity,
      total: Number(total.toFixed(2)),
      generatedAt: new Date().toISOString(),
    });
  };

  const generateQr = async () => {
    const QRCode = await import("qrcode");
    const url = await QRCode.toDataURL(buildQrPayload(), {
      margin: 1,
      width: 220,
      color: {
        dark: "#0F3D56",
        light: "#FFFFFF",
      },
    });

    setQrPreview(url);
    return url;
  };

  const downloadPdf = async () => {
    const [{ jsPDF }, qrUrl] = await Promise.all([import("jspdf"), generateQr()]);
    const values = getValues();
    const doc = new jsPDF();

    doc.setFillColor(15, 61, 86);
    doc.rect(0, 0, 210, 36, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(t.estimate.pdfTitle, 16, 18);
    doc.setFontSize(10);
    doc.text(branding.slogan, 16, 27);

    doc.setTextColor(15, 61, 86);
    doc.setFontSize(13);
    doc.text(t.estimate.client, 16, 52);
    doc.setTextColor(70, 80, 90);
    doc.setFontSize(10);
    doc.text(values.clientName, 16, 60);
    doc.text(values.clientEmail, 16, 67);
    doc.text(`${values.projectType} - ${values.propertyCity}`, 16, 74);

    doc.setTextColor(15, 61, 86);
    doc.setFontSize(13);
    doc.text(t.estimate.scope, 16, 92);
    doc.setFontSize(10);
    doc.setTextColor(70, 80, 90);

    let y = 101;
    items.forEach((item) => {
      doc.text(item.description, 16, y);
      doc.text(String(item.quantity), 135, y, { align: "right" });
      doc.text(currencyFormatter.format(item.unitPrice), 164, y, { align: "right" });
      doc.text(currencyFormatter.format(item.quantity * item.unitPrice), 194, y, {
        align: "right",
      });
      y += 8;
    });

    doc.setDrawColor(15, 61, 86);
    doc.line(16, y + 2, 194, y + 2);
    doc.setFontSize(11);
    doc.setTextColor(15, 61, 86);
    doc.text(t.estimate.subtotal, 145, y + 12);
    doc.text(currencyFormatter.format(subtotal), 194, y + 12, { align: "right" });
    doc.text(`${t.estimate.contingency} 10%`, 145, y + 20);
    doc.text(currencyFormatter.format(contingency), 194, y + 20, { align: "right" });
    doc.setFontSize(14);
    doc.text(t.estimate.estimatedTotal, 145, y + 32);
    doc.text(currencyFormatter.format(total), 194, y + 32, { align: "right" });

    doc.setFontSize(10);
    doc.setTextColor(80, 90, 100);
    doc.text(values.notes, 16, y + 48, { maxWidth: 118 });
    doc.addImage(qrUrl, "PNG", 158, y + 42, 32, 32);
    doc.text(t.estimate.scanQr, 158, y + 80);

    doc.save("kokistyle-estimate.pdf");
  };

  return (
    <section id="estimate" className="bg-white py-20 sm:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#0F3D56]/70">
              {t.estimate.eyebrow}
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#0F3D56] sm:text-5xl">
              {t.estimate.title}
            </h2>
            <p className="mt-6 leading-8 text-slate-700">
              {t.estimate.description}
            </p>

            <div className="mt-8 grid gap-4 rounded-lg bg-[#F5E9DA] p-5">
              {qrPreview ? (
                <img src={qrPreview} alt={t.estimate.qrAlt} className="size-36 rounded-lg bg-white p-2" />
              ) : (
                <div className="grid size-36 place-items-center rounded-lg border border-[#0F3D56]/20 bg-white text-[#0F3D56]">
                  <QrCode size={52} />
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" onClick={downloadPdf}>
                  <Download size={18} /> {t.estimate.exportPdf}
                </Button>
                <Button type="button" variant="secondary" onClick={() => window.print()}>
                  <Printer size={18} /> {t.estimate.print}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_20px_70px_rgba(15,61,86,0.12)] sm:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#0F3D56]">
                {t.estimate.clientName}
                <input
                  {...register("clientName")}
                  className="min-h-12 rounded-lg border border-slate-200 px-4 text-slate-900 outline-none focus:border-[#0F3D56]"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#0F3D56]">
                {t.estimate.clientEmail}
                <input
                  {...register("clientEmail")}
                  className="min-h-12 rounded-lg border border-slate-200 px-4 text-slate-900 outline-none focus:border-[#0F3D56]"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#0F3D56]">
                {t.estimate.projectType}
                <input
                  {...register("projectType")}
                  className="min-h-12 rounded-lg border border-slate-200 px-4 text-slate-900 outline-none focus:border-[#0F3D56]"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#0F3D56]">
                {t.estimate.propertyCity}
                <input
                  {...register("propertyCity")}
                  className="min-h-12 rounded-lg border border-slate-200 px-4 text-slate-900 outline-none focus:border-[#0F3D56]"
                />
              </label>
            </div>

            <div className="mt-7 overflow-x-auto">
              <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    <th className="border-b border-slate-200 pb-3">{t.estimate.item}</th>
                    <th className="border-b border-slate-200 pb-3 text-right">{t.estimate.qty}</th>
                    <th className="border-b border-slate-200 pb-3 text-right">{t.estimate.unit}</th>
                    <th className="border-b border-slate-200 pb-3 text-right">{t.estimate.total}</th>
                    <th className="border-b border-slate-200 pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-3">
                        <input
                          value={item.description}
                          onChange={(event) => updateItem(item.id, "description", event.target.value)}
                          className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#0F3D56]"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(event) => updateItem(item.id, "quantity", event.target.value)}
                          className="min-h-11 w-20 rounded-lg border border-slate-200 px-3 text-right text-sm outline-none focus:border-[#0F3D56]"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(event) => updateItem(item.id, "unitPrice", event.target.value)}
                          className="min-h-11 w-28 rounded-lg border border-slate-200 px-3 text-right text-sm outline-none focus:border-[#0F3D56]"
                        />
                      </td>
                      <td className="py-3 pr-3 text-right font-semibold text-[#0F3D56]">
                        {currencyFormatter.format(item.quantity * item.unitPrice)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="grid size-10 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={t.estimate.removeItem}
                        >
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col gap-5 border-t border-slate-200 pt-5 sm:flex-row sm:items-start sm:justify-between">
              <Button type="button" variant="secondary" onClick={addItem}>
                <Plus size={18} /> {t.estimate.addItem}
              </Button>
              <div className="min-w-56 space-y-2 text-sm">
                <div className="flex justify-between gap-8 text-slate-600">
                  <span>{t.estimate.subtotal}</span>
                  <strong>{currencyFormatter.format(subtotal)}</strong>
                </div>
                <div className="flex justify-between gap-8 text-slate-600">
                  <span>{t.estimate.contingency}</span>
                  <strong>{currencyFormatter.format(contingency)}</strong>
                </div>
                <div className="flex justify-between gap-8 border-t border-slate-200 pt-2 text-lg font-bold text-[#0F3D56]">
                  <span>{t.estimate.total}</span>
                  <span>{currencyFormatter.format(total)}</span>
                </div>
              </div>
            </div>

            <label className="mt-6 grid gap-2 text-sm font-semibold text-[#0F3D56]">
              {t.estimate.notes}
              <textarea
                {...register("notes")}
                rows={3}
                className="rounded-lg border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-[#0F3D56]"
              />
            </label>
          </div>
        </div>
      </Container>
    </section>
  );
}
