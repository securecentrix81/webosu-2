const BEATMAP_CACHE_NAME = "beatmap-files-v1";

// Function to start previewing a beatmap
function startpreview(box) {
    let volume = 1;
    if (window.gamesettings) {
        volume = (window.gamesettings.mastervolume / 100) * (window.gamesettings.musicvolume / 100);
        volume = Math.min(1, Math.max(0, volume));
    }

    for (let audio of document.getElementsByTagName("audio")) {
        if (audio.softstop) {
            audio.softstop();
        }
    }

    const audio = document.createElement("audio");
    const source = document.createElement("source");
    source.src = getPreviewUrl(box.sid);
    source.type = "audio/mpeg";
    audio.appendChild(source);

    audio.volume = 0;
    audio.play();
    document.body.appendChild(audio);

    const fadeIn = setInterval(() => {
        if (audio.volume < volume) {
            audio.volume = Math.min(volume, audio.volume + 0.05 * volume);
        } else {
            clearInterval(fadeIn);
        }
    }, 30);

    const fadeOut = setInterval(() => {
        if (audio.currentTime > 9.3) {
            audio.volume = Math.max(0, audio.volume - 0.05 * volume);
        }
        if (audio.volume === 0) {
            clearInterval(fadeOut);
            audio.remove();
        }
    }, 30);

    audio.softstop = function () {
        const fadeOutInterval = setInterval(() => {
            audio.volume = Math.max(0, audio.volume - 0.05 * volume);
            if (audio.volume === 0) {
                clearInterval(fadeOutInterval);
                audio.remove();
            }
        }, 10);
    };
    return audio;
}

async function startdownload(box) {
    let currentAudio = startpreview(box);
    if (box.downloading) return;

    box.downloading = true;
    box.classList.add("downloading");

    // 1. Create the UI immediately so the user sees feedback
    const container = document.createElement("div");
    container.className = "download-progress";
    const title = document.createElement("div");
    title.className = "title";
    title.innerText = box.setdata.title;
    const bar = document.createElement("progress");
    bar.max = 100;
    bar.value = 0;

    container.appendChild(title);
    container.appendChild(bar);

    const statuslines = document.getElementById("statuslines");
    if (statuslines) {
        statuslines.insertBefore(container, statuslines.children[3]);
    }

    const url = getDownloadUrl(box.sid);

    try {
        // 2. Check the cache
        const cache = await caches.open(BEATMAP_CACHE_NAME);
        const cachedResponse = await cache.match(url);

        if (cachedResponse) {
            console.log("Loading from cache:", box.sid);
            
            // Visual feedback: quickly fill the bar to show it's "loading"
            bar.value = 100;
            bar.className = "finished";
            
            const blob = await cachedResponse.blob();
            box.oszblob = blob;
            box.classList.remove("downloading");
            currentAudio.softstop();
            
            // Trigger loaded callback if it exists
            if (box.onloaded) box.onloaded();
            return;
        }

        // 3. Not in cache, proceed with actual fetch
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const cacheResponse = response.clone();
        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength, 10);
        let loaded = 0;
        bar.max = total;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            loaded += value.length;
            bar.value = loaded; // Update progress bar
        }

        const blob = new Blob(chunks);
        
        // Save to cache for next time
        cache.put(url, new Response(blob, {
            headers: { 
                'Content-Type': 'application/octet-stream',
                'Content-Length': blob.size 
            }
        }));

        box.oszblob = blob;
        bar.className = "finished";
        box.classList.remove("downloading");
        currentAudio.softstop();
        if (box.onloaded) box.onloaded();

    } catch (error) {
        console.error("Download failed:", error.message);
        alert("Beatmap download failed. Please retry later.");
        box.downloading = false;
        box.classList.remove("downloading");
        container.remove();
    }
}
