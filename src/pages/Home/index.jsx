import React from 'react';
import VideoJS from '@/components/VideoJS';

const Home = () => {
	const playerRef = React.useRef(null);

	const videoJsOptions = {
		autoplay: true,
		controls: true,
		responsive: true,
		fluid: true,
		sources: []
	};

	const handlePlayerReady = (player) => {
		playerRef.current = player;

		// You can handle player events here, for example:
		player.on('waiting', () => {
			videojs.log('player is waiting');
		});

		player.on('dispose', () => {
			videojs.log('player will dispose');
		});
	};

	const [videos, setVideos] = React.useState([]);

	React.useEffect(() => {
		const getVideos = async () => {
			const videoFiles = await window.electron.getVideos();
			setVideos(videoFiles);
		};
		getVideos();
	}, []);

	if (videos.length === 0) {
		return <div>Loading videos...</div>;
	}

	videoJsOptions.sources = videos;

	console.log(videos);

	return (
		<>
		<VideoJS options={videoJsOptions} onReady={handlePlayerReady} />
		</>
	);
};

export default Home;
