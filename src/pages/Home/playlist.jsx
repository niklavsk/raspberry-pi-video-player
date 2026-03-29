import React, { useState, useEffect, useRef } from 'react';

import { formatDuration, formatFileSize } from '@/helpers/format';

const Playlist = ({ videos, currentVideoIndex, setCurrentVideoIndex, loading, error }) => {
	const handleVideoSelection = (index) => {
		setCurrentVideoIndex(index);
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
				{videoFile.isWebcam ? (
					<div className="webcam-thumbnail">📷</div>
				) : (
					<>
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
					</>
				)}
			</div>
		);
	};

	return (
		<div id="videoListContainer">
			<h2 style={{ marginTop: '20px', marginBottom: '10px', color: '#333', fontSize: '1.2em' }}>📋 Playlist</h2>
			<div id="videoList" className={loading ? 'loading' : 'video-list'}>
				{loading && 'Loading videos...'}
				{error && <p className="error">{error}</p>}
				{!loading && !error && videos.length === 0 && <p className="error">No video files found in the video folder.</p>}
				{videos.map((videoFile, index) => (
					<div
						key={videoFile.path}
						className={`video-item ${currentVideoIndex === index ? 'active' : ''}`}
						onClick={() => handleVideoSelection(index)}
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
	);
};

export default Playlist;
