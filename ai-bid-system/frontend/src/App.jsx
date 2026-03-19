import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import CreateBid from './pages/CreateBid';
import MyBids from './pages/MyBids';
import BidAnalysis from './pages/BidAnalysis';
import ImageLibrary from './pages/ImageLibrary';
import ProductLibrary from './pages/ProductLibrary';
import KnowledgeBase from './pages/KnowledgeBase';

// 临时页面组件
const BidReview = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">标书审查</h1>
    <p className="text-gray-600">标书审查功能开发中...</p>
  </div>
);

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/create-bid" replace />} />
          <Route path="create-bid" element={<CreateBid />} />
          <Route path="my-bids" element={<MyBids />} />
          <Route path="bid-analysis" element={<BidAnalysis />} />
          <Route path="bid-review" element={<BidReview />} />
          <Route path="image-library" element={<ImageLibrary />} />
          <Route path="product-library" element={<ProductLibrary />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;