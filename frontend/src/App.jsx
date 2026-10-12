import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Warehouses from './pages/Warehouses.jsx';
import Suppliers from './pages/Suppliers.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import { Receive, Issue, Transfer } from './pages/Operations.jsx';
import Stocktake from './pages/Stocktake.jsx';
import Stock from './pages/Stock.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';

function Shell() {
  const { user, logout, can } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const nav = [
    { to: '/', label: 'Dashboard', show: true, end: true },
    { to: '/stock', label: 'Stock levels', show: true },
    { to: '/products', label: 'Products', show: true },
    { to: '/warehouses', label: 'Warehouses', show: true },
    { to: '/suppliers', label: 'Suppliers', show: true },
    { to: '/purchase-orders', label: 'Purchase orders', show: true },
    { group: 'Inventory operations' },
    { to: '/receive', label: 'Receive stock', show: can('Warehouse Staff', 'Warehouse Manager') },
    { to: '/issue', label: 'Issue stock', show: can('Warehouse Staff', 'Warehouse Manager') },
    { to: '/transfer', label: 'Transfer stock', show: can('Warehouse Staff', 'Warehouse Manager') },
    { to: '/stocktake', label: 'Stocktake', show: can('Warehouse Manager') },
    { group: 'Management' },
    { to: '/reports', label: 'Reports', show: can('Warehouse Manager') },
    { to: '/users', label: 'Users', show: can() },
  ];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">IWMS<small>Inventory &amp; Warehouse</small></div>
        <nav aria-label="Main">
          {nav.map((n, i) => n.group
            ? <div key={i} className="nav-group">{n.group}</div>
            : n.show && <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>)}
        </nav>
        <div className="me">
          <strong>{user.name}</strong>
          <span>{user.role}</span>
          <button onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="stock" element={<Stock />} />
        <Route path="products" element={<Products />} />
        <Route path="warehouses" element={<Warehouses />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="receive" element={<Receive />} />
        <Route path="issue" element={<Issue />} />
        <Route path="transfer" element={<Transfer />} />
        <Route path="stocktake" element={<Stocktake />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
