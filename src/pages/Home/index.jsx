import React, { useState, useEffect, useRef } from 'react';
import { APP_MODE } from '@/config';

const Home = () => {
	const [videos, setVideos] = useState([]);
	const [currentVideo, setCurrentVideo] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const videoRef = useRef(null);

	// Format file size
	const formatFileSize = (bytes) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	};

	// Format duration
	const formatDuration = (seconds) => {
		if (!seconds || isNaN(seconds)) return '--:--';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	// Load video files
	useEffect(() => {
		const loadVideoFiles = async () => {
			try {
				const videoFiles = await window.electronAPI.getVideoFiles();
				console.log('Found video files:', videoFiles);
				setVideos(videoFiles);

				if (videoFiles.length > 0) {
					setCurrentVideo(videoFiles[0]);
				}
			} catch (err) {
				console.error('Error loading video files:', err);
				setError(`Error loading video files: ${err.message}`);
			} finally {
				setLoading(false);
			}
		};

		loadVideoFiles();
	}, []);

	// Effect to play video when currentVideo changes
	useEffect(() => {
		if (currentVideo && videoRef.current) {
			videoRef.current.load();
			videoRef.current.play().catch(err => console.log('Autoplay prevented:', err));
		}
	}, [currentVideo]);

	// Effect for handling video end
	useEffect(() => {
		const videoElement = videoRef.current;
		if (!videoElement) return;

		const handleVideoEnd = () => {
			const currentIndex = videos.findIndex(v => v.path === currentVideo.path);
			const nextIndex = (currentIndex + 1) % videos.length;
			setCurrentVideo(videos[nextIndex]);
		};

		videoElement.addEventListener('ended', handleVideoEnd);

		return () => {
			videoElement.removeEventListener('ended', handleVideoEnd);
		};
	}, [currentVideo, videos]);

	// Effect for keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (!videoRef.current) return;

			const videoElement = videoRef.current;

			switch (e.key) {
				case 'ArrowRight':
					videoElement.currentTime += 5; // Seek forward 5 seconds
					break;
				case 'ArrowLeft':
					videoElement.currentTime -= 5; // Seek backward 5 seconds
					break;
				case ' ':
					if (videoElement.paused) {
						videoElement.play();
					} else {
						videoElement.pause();
					}
					e.preventDefault(); // Prevent space from scrolling
					break;
				case 'ArrowUp':
					if (videoElement.volume < 1) {
						videoElement.volume = Math.min(1, videoElement.volume + 0.1);
					}
					break;
				case 'ArrowDown':
					if (videoElement.volume > 0) {
						videoElement.volume = Math.max(0, videoElement.volume - 0.1);
					}
					break;
				case 'f':
					if (document.fullscreenElement) {
						document.exitFullscreen();
					} else {
						videoRef.current.requestFullscreen();
					}
					break;
				case 'm':
					videoElement.muted = !videoElement.muted;
					break;
				default:
					break;
			}
		};

		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, []);

	const handleVideoSelection = (videoFile) => {
		setCurrentVideo(videoFile);
	};

	const VideoThumbnail = ({ videoFile }) => {
		const thumbVideoRef = useRef(null);
		const [duration, setDuration] = useState(null);

		useEffect(() => {
			const videoElement = thumbVideoRef.current;
			if (!videoElement) return;

			const onLoadedMetadata = () => {
				setDuration(videoElement.duration);
				const seekTime = Math.min(1, videoElement.duration * 0.1);
				videoElement.currentTime = seekTime;
			};

			videoElement.addEventListener('loadedmetadata', onLoadedMetadata);

			return () => {
				videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
			};
		}, [videoFile]);

		return (
			<div className="video-thumbnail">
				<video
					ref={thumbVideoRef}
					src={videoFile.url}
					muted
					preload="metadata"
					style={{ width: '100%', height: '100%', objectFit: 'cover' }}
				/>
				{duration && (
					<div className="video-duration">
						{formatDuration(duration)}
					</div>
				)}
			</div>
		);
	};

	if (APP_MODE === 'prod') {
		return (
			<video ref={videoRef} id="videoPlayer" src={currentVideo?.url} style={{ width: '100vw', height: '100vh', objectFit: 'cover' }}>
				Your browser does not support the video tag.
			</video>
		);
	}

	return (
		<div className="container">
			<h1>🎬 Electron Video Player</h1>

			<div className="video-wrapper">
				<video ref={videoRef} id="videoPlayer" controls src={currentVideo?.url}>
					Your browser does not support the video tag.
				</video>
			</div>

			<div className="info" id="videoInfo">
				<p><strong>Protocol:</strong> Custom app:// protocol</p>
				<p><strong>Video Source:</strong> <span id="currentVideoSource">{currentVideo?.name || 'No video selected'}</span></p>
				<p><strong>File Size:</strong> <span id="currentVideoSize">{currentVideo ? formatFileSize(currentVideo.size) : '-'}</span></p>
			</div>

			<div id="videoListContainer">
				<h2 style={{ marginTop: '20px', marginBottom: '10px', color: '#333', fontSize: '1.2em' }}>📋 Playlist</h2>
				<div id="videoList" className={loading ? 'loading' : 'video-list'}>
					{loading && 'Loading videos...'}
					{error && <p className="error">{error}</p>}
					{!loading && !error && videos.length === 0 && <p className="error">No video files found in the video folder.</p>}
					{videos.map((videoFile) => (
						<div
							key={videoFile.path}
							className={`video-item ${currentVideo?.path === videoFile.path ? 'active' : ''}`}
							onClick={() => handleVideoSelection(videoFile)}
						>
							<VideoThumbnail videoFile={videoFile} />
							<div className="video-details">
								<div className="video-item-name" title={videoFile.name}>
									{videoFile.name}
								</div>
								<div className="video-item-meta">
									<span className="video-item-size">
										{formatFileSize(videoFile.size)}
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

export default Home;
