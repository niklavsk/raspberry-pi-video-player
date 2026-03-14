import * as React from 'react';
import { createRoot } from 'react-dom/client';
import Home from './pages/Home';

const root = createRoot(document.body);
root.render(<Home />);

window.electron.onGpioIn((...args) => {
	console.log('onGpioIn', ...args);
});

// createRoot(document.getElementById('root')).render(
// 	<Home />
// );
