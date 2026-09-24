"use client";

import { useState } from "react";
import { PasteTab } from "@/components/PasteTab";
import { CheckAddressTab } from "@/components/CheckAddressTab";

type Tab = "paste" | "address";

export default function Home() {
  const [tab, setTab] = useState<Tab>("paste");

  return (
    <main>
      <header className="site-header">
        <h1>PermissionLens</h1>
        <p className="tagline">What authority does this signature actually grant?</p>
      </header>

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "paste"}
          className={tab === "paste" ? "tab active" : "tab"}
          onClick={() => setTab("paste")}
        >
          Paste a request
        </button>
        <button
          role="tab"
          aria-selected={tab === "address"}
          className={tab === "address" ? "tab active" : "tab"}
          onClick={() => setTab("address")}
        >
          Check an address
        </button>
      </nav>

      {tab === "paste" ? <PasteTab /> : <CheckAddressTab />}

      <footer className="site-footer">
        <p>
          PermissionLens never says a grant is &quot;safe&quot; — only what a check did or didn&apos;t find. Source
          and registry on{" "}
          <a href="https://github.com/DinVisel/permission-lens" target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
