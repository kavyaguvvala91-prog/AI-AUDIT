import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import AnalysisPage from './pages/AnalysisPage.jsx'
import MetricsPage from './pages/MetricsPage.jsx'
import MonitoringPage from './pages/MonitoringPage.jsx'
import GovernancePage from './pages/GovernancePage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<MainLayout />}>
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/quality" element={<Navigate to="/analysis" replace />} />
          <Route path="/explainability" element={<Navigate to="/governance" replace />} />
          <Route path="/comparison" element={<Navigate to="/metrics" replace />} />
          <Route path="/retraining" element={<Navigate to="/governance" replace />} />
          <Route path="/realtime" element={<Navigate to="/monitoring" replace />} />
          <Route path="/fairness" element={<Navigate to="/governance" replace />} />
          <Route path="*" element={<Navigate to="/upload" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
