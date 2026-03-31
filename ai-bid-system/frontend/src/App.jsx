import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import CreateBid from './pages/CreateBid';
import MyBids from './pages/MyBids';
import BidAnalysis from './pages/BidAnalysis';
import ImageLibrary from './pages/ImageLibrary';
import KnowledgeBase from './pages/KnowledgeBase';
import Profile from './pages/Profile';
import BidDetail from './pages/BidDetail';
import CompanyProfile from './pages/CompanyProfile';
import ProductLibrary from './pages/ProductLibrary';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* 受保护路由 */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/create-bid" replace />} />
            <Route path="create-bid" element={<CreateBid />} />
            <Route path="my-bids" element={<MyBids />} />
            <Route path="bid-analysis" element={<BidAnalysis />} />
            <Route path="bid-analysis/:id" element={<BidDetail />} />
            <Route path="image-library" element={<ImageLibrary />} />
            <Route path="knowledge-base" element={<KnowledgeBase />} />
            <Route path="company-profiles" element={<CompanyProfile />} />
            <Route path="product-library" element={<ProductLibrary />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          
          {/* 默认重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;