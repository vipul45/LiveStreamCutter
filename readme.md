🎥 LiveStreamCutter
Effortlessly cut live webcam streams into before and after video clips!
LiveStreamCutter is a Node.js application that processes an HLS (HTTP Live Streaming) stream from a webcam, generating two 10-second video clips for any given timestamp: one covering the 10 seconds before the timestamp and another for the 10 seconds after. Built with TypeScript, FFmpeg, and Node.js, this tool is perfect for creating highlight clips from live streams.


🚀 Features

Dual Video Output: Generates "before" and "after" 10-second clips based on a specified timestamp.
HLS Stream Processing: Works with live webcam streams encoded as HLS with 8.66-second segments.
Automatic Directory Management: Creates temp and output folders as needed.
Clean Temporary Files: Deletes temporary segment files after processing.
Timestamp-Based Filenames: Saves videos as before_<timestamp>.ts and after_<timestamp>.ts.


📋 Prerequisites
Before setting up the project, ensure you have:

Windows operating system (tested on Windows 10/11).
Administrator access for PowerShell to install Chocolatey and FFmpeg.
Internet connection for downloading dependencies and fetching the stream.
Webcam connected and accessible via DirectShow.


🛠️ Installation and Setup
Follow these steps to set up and run LiveStreamCutter:
1. Install Chocolatey and FFmpeg
FFmpeg is required to process the video stream and create clips, and Chocolatey is used to install it.

Open PowerShell as Administrator:

Press Win + S, type PowerShell, right-click, and select Run as administrator.


Install Chocolatey (a package manager for Windows):
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))


Install FFmpeg using Chocolatey:
choco install ffmpeg


Verify FFmpeg installation:
ffmpeg -version


You should see output like ffmpeg version 7.1.1-essentials_build.



2. Create Folders for the Stream
The project stores the HLS stream in a dedicated folder.

Create the hls folder:New-Item -ItemType Directory -Path "E:\hls"



3. Execute FFmpeg to Stream the Webcam
Run FFmpeg to capture your webcam feed and generate an HLS stream.

In the Administrator PowerShell, navigate to a working directory (e.g., E:\):
cd E:\


Run the FFmpeg command:
ffmpeg -f dshow -rtbufsize 100M -framerate 30 -video_size 640x480 -i video="Integrated Webcam" -vf "drawtext=fontfile=C\\:/Windows/Fonts/arial.ttf:text=%{localtime}:fontsize=24:fontcolor=white:x=10:y=10:box=1:boxcolor=0x00000099" -c:v libx264 -preset ultrafast -tune zerolatency -f hls -hls_time 8.66 -hls_list_size 5 -hls_flags delete_segments+append_list+program_date_time -hls_segment_filename "E:/hls/segment_%03d.ts" E:/hls/stream.m3u8


This captures a 640x480 webcam feed at 30 FPS, overlays a timestamp, and generates 8.66-second HLS segments in E:\hls.



4. Install Python
Python is needed to run a local HTTP server to serve the HLS stream.

Download and install Python from python.org.

Ensure you select Add Python to PATH during installation.


Verify Python installation:
python --version


You should see output like Python 3.12.x.



5. Set Up the HTTP Server
Serve the HLS stream via a local HTTP server.

Open a new PowerShell window (no Administrator needed):
cd E:\hls


Start the HTTP server:
python -m http.server 8000


This serves stream.m3u8 at http://localhost:8000/stream.m3u8.
Keep this window open while running the project.



6. Clone the Repository
Get the LiveStreamCutter code from GitHub.

Open another PowerShell window and navigate to your desired directory:
cd E:\


Clone the repository:
git clone https://github.com/your-username/LiveStreamCutter.git
cd E:\LiveStreamCutter


Replace your-username with your GitHub username.



7. Install Dependencies
Install the Node.js dependencies required for the project.

Ensure you have Node.js installed (v20.21.0 or later):
node --version


Install dependencies:
npm install



8. Run the Project
Execute the script to generate the before and after videos.

Start the development server:
npm run dev


This runs nodemon src/index.ts, processing the stream and creating videos in E:\LiveStreamCutter\output.


The script generates:

output/before_2025-06-03T08-03-33.ts: 10 seconds ending at 08:03:33.
output/after_2025-06-03T08-03-33.ts: 10 seconds starting at 08:03:33.




📂 Project Structure
LiveStreamCutter/
├── src/
│   └── index.ts        # Main script to process the HLS stream
├── temp/               # Temporary segment files (auto-deleted)
├── output/             # Output videos (before_*.ts, after_*.ts)
├── nodemon.json        # Nodemon configuration to ignore temp/output
├── package.json        # Node.js dependencies and scripts
└── README.md           # Project documentation


⚙️ Configuration

Timestamp: The script uses a hardcoded timestamp (2025-06-03T08:03:33+05:30). To use a different time, edit src/index.ts:
const providedTime = DateTime.fromISO('your-timestamp', { zone: 'Asia/Kolkata' });

Or use the current time:
const providedTime = DateTime.now().setZone('Asia/Kolkata');


Nodemon: The nodemon.json ignores temp and output to prevent restarts:
{
  "ignore": ["temp/*", "output/*", "temp/**", "output/**"]
}




🖼️ Usage

Ensure FFmpeg and the HTTP server are running.
Run npm run dev to generate videos.
Check E:\LiveStreamCutter\output for before_<timestamp>.ts and after_<timestamp>.ts.
Play videos with a media player like VLC or FFmpeg:ffplay E:\LiveStreamCutter\output\before_2025-06-03T08-03-33.ts
ffplay E:\LiveStreamCutter\output\after_2025-06-03T08-03-33.ts




🛠️ Troubleshooting

No Videos Created:

Check the playlist: Invoke-WebRequest -Uri http://localhost:8000/stream.m3u8.
Ensure segments cover the timestamp (e.g., 08:03:33).
Run PowerShell as Administrator for directory permissions.


Nodemon Restarts:

Verify nodemon.json exists.
Run without nodemon:ts-node src/index.ts




Segment Download Errors:

Ensure the HTTP server is running and stream.m3u8 is accessible.
Clear E:\hls and restart FFmpeg:del /q E:\hls\*






🤝 Contributing
Contributions are welcome! To contribute:

Fork the repository.
Create a feature branch: git checkout -b feature/your-feature.
Commit changes: git commit -m 'Add your feature'.
Push to the branch: git push origin feature/your-feature.
Open a Pull Request.


🌟 Acknowledgements

FFmpeg for video processing.
Chocolatey for package management.
Node.js and TypeScript for the runtime and language.
Luxon for date-time handling.
node-fetch for HTTP requests.


Happy Streaming! 🎬
