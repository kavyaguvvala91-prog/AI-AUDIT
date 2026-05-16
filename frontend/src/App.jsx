import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import AnalysisPage from './pages/AnalysisPage.jsx'
import MetricsPage from './pages/MetricsPage.jsx'
import MonitoringPage from './pages/MonitoringPage.jsx'

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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
