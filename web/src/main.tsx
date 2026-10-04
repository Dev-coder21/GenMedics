import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useRoute, useScrollTop } from "./lib/router.js";
import { useDB, currentUser } from "./lib/store.js";
import { Header, Footer, Toaster, AuthModal, ChatWidget } from "./components/Shell.js";
import Home from "./pages/Home.js";
import Medicines from "./pages/Medicines.js";
import Product from "./pages/Product.js";
import Cart, { Checkout } from "./pages/Cart.js";
import { Orders, OrderDetail, AccountPage, Wishlist } from "./pages/Account.js";
import Prescriptions from "./pages/Prescriptions.js";
import Info, { NotFound } from "./pages/Info.js";
import Admin from "./admin/Admin.js";

const TITLES: Record<string, string> = { medicines: "Medicines", product: "Medicine", cart: "Cart", checkout: "Checkout", orders: "Orders", prescriptions: "Scan prescription", account: "Account", wishlist: "Wishlist", admin: "Admin console" };

class Boundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="wrap py-20 text-center">
        <h1 className="h-display text-4xl mb-3">Something went wrong</h1>
        <p className="text-body mb-6 font-mono text-sm">{this.state.err.message}</p>
        <a className="btn-primary no-underline" href="#/" onClick={() => this.setState({ err: null })}>Go home</a>
      </div>
    );
  }
}

function App() {
  const { path, parts } = useRoute();
  const db = useDB();
  useScrollTop(path);
  useEffect(() => { document.documentElement.lang = db.lang; }, [db.lang]);
  useEffect(() => {
    const t = parts[0] === "admin" ? db.settings.portalTitle : TITLES[parts[0]];
    document.title = t ? `${t} · GenMedics` : "GenMedics — the medicine you take, for a fraction of the price";
  }, [path, db.settings.portalTitle]);

  if (parts[0] === "admin") return <Boundary><Admin section={parts[1] || "overview"} /><Toaster /></Boundary>;

  let page: React.ReactNode;
  switch (parts[0]) {
    case undefined: page = <Home />; break;
    case "medicines": page = <Medicines />; break;
    case "product": page = <Product key={parts[1]} id={Number(parts[1])} />; break;
    case "cart": page = <Cart />; break;
    case "checkout": page = <Checkout />; break;
    case "orders": page = parts[1] ? <OrderDetail id={Number(parts[1])} /> : <Orders />; break;
    case "prescriptions": case "scan": page = <Prescriptions />; break;
    case "account": page = <AccountPage key={currentUser(db)?.id || "anon"} />; break;
    case "wishlist": page = <Wishlist />; break;
    case "page": page = <Info key={parts[1]} slug={parts[1]} />; break;
    default: page = <NotFound />;
  }
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }} className="sr-only-x focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:bg-white focus:p-3 focus:rounded-lg">Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 outline-none"><Boundary key={path}>{page}</Boundary></main>
      <Footer />
      <AuthModal />
      <ChatWidget />
      <Toaster />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
