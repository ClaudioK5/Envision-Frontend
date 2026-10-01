import { Routes, Route } from "react-router-dom";
import { PaymentSuccessHandler } from "./components/subscription/PaymentSuccessHandler";
import { Layout } from "./components/Layout";
import { AccountPage } from "./pages/AccountPage";
import { EnvisionPage } from "./pages/EnvisionPage";

export default function App() {
  return (
    <>
      <PaymentSuccessHandler />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<EnvisionPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
      </Routes>
    </>
  );
}
