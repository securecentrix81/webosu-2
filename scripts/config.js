/*
// scripts/config.js
const BEATMAP_PROVIDER = {
    // Beatmap .osz download
    DOWNLOAD: "https://txy1.sayobot.cn/beatmaps/download/mini/",
    
    // Audio preview (mp3)
    PREVIEW: "https://cdn.sayobot.cn:25225/preview/",
    
    // Cover image
    COVER: "https://cdn.sayobot.cn:25225/beatmaps/",
    
    // Beatmap info API (single map details)
    API_INFO: "https://api.sayobot.cn/beatmapinfo?1=",
    API_INFO_V2: "https://api.sayobot.cn/v2/beatmapinfo?0=",
    
    // Beatmap list API (browsing/searching)
    API_LIST: "https://api.sayobot.cn/beatmaplist"
};

// Helper functions for URL construction
function getDownloadUrl(sid) {
    return `${BEATMAP_PROVIDER.DOWNLOAD}${sid}`;
}

function getPreviewUrl(sid) {
    return `${BEATMAP_PROVIDER.PREVIEW}${sid}.mp3`;
}

function getCoverUrl(sid) {
    return `${BEATMAP_PROVIDER.COVER}${sid}/covers/cover.webp`;
}

function getInfoUrl(sid) {
    return `${BEATMAP_PROVIDER.API_INFO}${sid}`;
}

function getInfoUrlV2(sid) {
    return `${BEATMAP_PROVIDER.API_INFO_V2}${sid}`;
}

*/

// scripts/config.js

const BEATMAP_PROVIDER = {
    // Beatmap .osz download (using ?noVideo=1 to mimic the original 'mini' behavior)
    DOWNLOAD: "https://osu.direct/d/",
    
    // Audio preview (mp3) - redirected to official osu! assets
    PREVIEW: "https://b.ppy.sh/preview/",
    
    // Cover image - redirected to official osu! assets
    COVER: "https://assets.ppy.sh/beatmaps/",
    
    // Beatmap info API (osu.direct uses the same endpoint for set info)
    API_INFO: "https://osu.direct/api/v2/s/",
    API_INFO_V2: "https://osu.direct/api/v2/s/",
    
    // Beatmap list API (searching)
    API_LIST: "https://osu.direct/api/v2/search"
};

// Helper functions for URL construction
function getDownloadUrl(sid) {
    // Adding ?noVideo=1 to approximate the 'mini' download from Sayobot
    return `${BEATMAP_PROVIDER.DOWNLOAD}${sid}?noVideo=1`;
}

function getPreviewUrl(sid) {
    return `${BEATMAP_PROVIDER.PREVIEW}${sid}.mp3`;
}

function getCoverUrl(sid) {
    // osu! official assets use .jpg for covers
    return `${BEATMAP_PROVIDER.COVER}${sid}/covers/cover.jpg`;
}

function getInfoUrl(sid) {
    return `${BEATMAP_PROVIDER.API_INFO}${sid}`;
}

function getInfoUrlV2(sid) {
    return `${BEATMAP_PROVIDER.API_INFO_V2}${sid}`;
}

/**
 * COMPATIBILITY PATCH
 * This intercepts fetch calls to osu.direct and translates the response
 * into the format your existing scripts expect from Sayobot.
 */
(function patchFetchForOsuDirect() {
    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = args[0] instanceof Request ? args[0].url : args[0];

        // Only intercept if it's an osu.direct API call
        if (typeof url === "string" && url.includes("osu.direct/api/v2/")) {
            const originalJson = response.json.bind(response);
            
            // Override the .json() method to reshape the data
            response.json = async () => {
                const data = await originalJson();
                
                // Case 1: Search results (API_LIST)
                // Expected: { data: [ {sid, title, artist, creator, approved}, ... ] }
                if (data.beatmapsets && Array.isArray(data.beatmapsets)) {
                    return {
                        data: data.beatmapsets.map(set => ({
                            sid: set.id,
                            title: set.title,
                            artist: set.artist,
                            creator: set.creator,
                            approved: set.ranked
                        }))
                    };
                }

                // Case 2: Beatmapset info (API_INFO / API_INFO_V2)
                // If it's a single set object from /api/v2/s/{id}
                if (data.id && data.beatmaps) {
                    // Check if the caller expects a list of difficulties (API_INFO)
                    // or set metadata (API_INFO_V2)
                    
                    // Transformation for API_INFO (requestMoreInfo expects res.data to be an array)
                    const difficulties = data.beatmaps.map(b => ({
                        bid: b.id,
                        mode: b.mode_int,
                        star: b.difficulty_rating,
                        version: b.version,
                        creator: data.creator,
                        length: b.total_length,
                        BPM: b.bpm
                    }));

                    // Transformation for API_INFO_V2 (addBeatmapSid expects res.data to be an object)
                    const setMetadata = {
                        sid: data.id,
                        title: data.title,
                        artist: data.artist,
                        creator: data.creator,
                        approved: data.ranked
                    };

                    // We return a "hybrid" that satisfies both requestMoreInfo (res.data = array)
                    // and addBeatmapSid (res.data = object). 
                    // Since requestMoreInfo uses res.data.filter, we check the context or 
                    // simply provide what the specific callers need.
                    
                    // To be safe, we detect if the URL matches the V2 pattern or V1
                    // However, in your code, addBeatmapSid uses res.data.sid while 
                    // requestMoreInfo uses res.data.filter.
                    
                    return {
                        status: 0,
                        // If there are difficulties, we prioritize the array format for requestMoreInfo
                        // but attach the set metadata so addBeatmapSid doesn't break.
                        data: Object.assign(difficulties, setMetadata)
                    };
                }

                return data;
            };
        }
        return response;
    };
})();
