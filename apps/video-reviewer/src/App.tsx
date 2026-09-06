import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReviewListPage } from './pages/ReviewListPage';
import { ReviewPage } from './pages/ReviewPage';

/**
 * The reviewer. Two screens: every finished video, and one video as its parts.
 *
 * This app is a COPY of video-bright's frontend, taken so the editing surface is already here when
 * the editing phase starts (TimelineEditor, SlotPanel, SlotCard, CommentThread and the rest are all
 * still in src/, untouched and unrouted). Nothing imports them yet, so none of their API calls run
 * and no backend is required. video-bright itself is not modified and not imported from.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ReviewListPage />} />
        <Route path="/review/:project" element={<ReviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
