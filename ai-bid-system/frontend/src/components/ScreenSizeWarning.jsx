import { useEffect, useState } from 'react';
import { Alert } from 'antd';

const STORAGE_KEY = 'screen-size-warning-dismissed';
const MIN_WIDTH = 1440;

const ScreenSizeWarning = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === 'true') return;

    const checkWidth = () => {
      if (window.innerWidth < MIN_WIDTH) {
        setVisible(true);
      }
    };

    checkWidth();
  }, []);

  const handleClose = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  if (!visible) return null;

  return (
    <Alert
      banner
      type="warning"
      showIcon
      closable
      onClose={handleClose}
      message={
        <span>
          检测到当前屏幕显示空间较小，可能会影响部分表单填写操作。建议您按住键盘{' '}
          <kbd className="px-1.5 py-0.5 mx-0.5 text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded">
            Ctrl
          </kbd>{' '}
          键并向下滚动鼠标滚轮（或按{' '}
          <kbd className="px-1.5 py-0.5 mx-0.5 text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded">
            Ctrl + -
          </kbd>{' '}
          键），将浏览器缩放至 80% 或以下以获得最佳体验。
        </span>
      }
    />
  );
};

export default ScreenSizeWarning;