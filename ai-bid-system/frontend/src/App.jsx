import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import CreateBid from './pages/CreateBid';
import MyBids from './pages/MyBids';
import BidAnalysis from './pages/BidAnalysis';
import BidReview from './pages/BidReview';
import ImageLibrary from './pages/ImageLibrary';
import KnowledgeBase from './pages/KnowledgeBase';

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
          <Route path="knowledge-base" element={<KnowledgeBase />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;