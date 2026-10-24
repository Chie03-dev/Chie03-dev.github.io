"use client";

import { useState } from "react";

import { site } from "@/lib/site";

export function ContactForm() {
  const endpoint = site.contactFormEndpoint;
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">(
    "idle",
  );
  const [toast, setToast] = useState("");

  if (!endpoint) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    // Honeypot
    if (data.get("_gotcha")) return;
    setStatus("pending");
    setToast("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
        }),
      });
      if (res.ok) {
        setStatus("success");
        setToast("Message sent. I'll get back to you soon.");
        form.reset();
      } else {
        setStatus("error");
        setToast("Something went wrong. Please email me directly.");
      }
    } catch {
      setStatus("error");
      setToast("Something went wrong. Please email me directly.");
    }
  }

  return (
    <div className="mb-8">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <input
          type="text"
          name="_gotcha"
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <input
            required
            name="name"
            type="text"
            className="rounded-md border border-border/40 bg-background px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Email</span>
          <input
            required
            name="email"
            type="email"
            className="rounded-md border border-border/40 bg-background px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Message</span>
          <textarea
            required
            name="message"
            rows={4}
            className="rounded-md border border-border/40 bg-background px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={status === "pending"}
          className="inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {status === "pending" ? "Sending..." : "Send message"}
        </button>
      </form>
      {toast && (
        <p
          role="status"
          className="mt-3 text-sm text-muted-foreground"
          aria-live="polite"
        >
          {toast}
        </p>
      )}
    </div>
  );
}
