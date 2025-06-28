import { HashRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UserForm from "./pages/UserForm";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/form/:eventId" element={<UserForm />} />
        <Route path="/" element={<Login />} />
      </Routes>
    </HashRouter>
  );
}