import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { OrderAlertsProvider } from './contexts/OrderAlertsProvider'
import { LoadingScreen } from './components/LoadingScreen'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PublicOnlyRoute } from './components/PublicOnlyRoute'
import { Dashboard } from './pages/Dashboard'
import { Alerts } from './pages/Alerts'
import { ForgotPassword } from './pages/ForgotPassword'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { Impact } from './pages/Impact'
import { Import } from './pages/Import'
import { Login } from './pages/Login'
import { Lookup } from './pages/Lookup'
import { Medicines } from './pages/Medicines'
import { NotFound } from './pages/NotFound'
import { Orders } from './pages/Orders'
import { Register } from './pages/Register'
import { SelectRole } from './pages/SelectRole'
import { Stock } from './pages/Stock'
import { Warehouses } from './pages/Warehouses'

// The 3D page is loaded only when opened (it brings the large three.js library).
const Packing = lazy(() => import('./pages/Packing').then((module) => ({ default: module.Packing })))

// All the pages of the app, in one place.
function App() {
  return (
    <OrderAlertsProvider>
    <Routes>
      <Route path="/" element={<Home />} />

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPassword />
          </PublicOnlyRoute>
        }
      />

      {/* signed in, but the role is not chosen yet */}
      <Route
        path="/select-role"
        element={
          <ProtectedRoute allowWithoutRole>
            <SelectRole />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/warehouses"
        element={
          <ProtectedRoute>
            <Warehouses />
          </ProtectedRoute>
        }
      />

      <Route
        path="/medicines"
        element={
          <ProtectedRoute>
            <Medicines />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock"
        element={
          <ProtectedRoute>
            <Stock />
          </ProtectedRoute>
        }
      />
      <Route
        path="/packing"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingScreen />}>
              <Packing />
            </Suspense>
          </ProtectedRoute>
        }
      />

      <Route path="/lookup" element={<ProtectedRoute><Lookup /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/impact" element={<ProtectedRoute><Impact /></ProtectedRoute>} />
      <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </OrderAlertsProvider>
  )
}

export default App
