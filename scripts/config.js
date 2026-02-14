// 1. Retrieve setting
var savedSettings = JSON.parse(localStorage.getItem("osugamesettings") || "{}");
var providerId = savedSettings.beatmapProvider || 0;

// 2. Define URL Templates
// To add a new provider, just add a new entry here.
const PROVIDER_TEMPLATES = {
    0: {
        name: "Sayobot",
        DOWNLOAD: "https://txy1.sayobot.cn/beatmaps/download/mini/{sid}",
        PREVIEW: "https://cdn.sayobot.cn:25225/preview/{sid}.mp3",
        COVER: "https://cdn.sayobot.cn:25225/beatmaps/{sid}/covers/cover.webp",
        API_INFO: "https://api.sayobot.cn/beatmapinfo?1={sid}",
        API_LIST: "https://api.sayobot.cn/beatmaplist"
    },
    1: {
        name: "osu.direct",
        DOWNLOAD: "https://api.nerinyan.moe/d/{sid}?noVideo=1",
        PREVIEW: "https://b.ppy.sh/preview/{sid}.mp3",
        COVER: "https://assets.ppy.sh/beatmaps/{sid}/covers/cover.jpg",
        API_INFO: "https://osu.direct/api/v2/s/{sid}",
        API_LIST: "https://osu.direct/api/v2/search"
    }
};

// Select the current provider (fallback to 0 if not found)
var activeProvider = PROVIDER_TEMPLATES[providerId] || PROVIDER_TEMPLATES[0];

// 3. Helper functions
// These now automatically use the templates defined above
function getDownloadUrl(sid) {
    return activeProvider.DOWNLOAD.replace("{sid}", sid);
}

function getPreviewUrl(sid) {
    return activeProvider.PREVIEW.replace("{sid}", sid);
}

function getCoverUrl(sid) {
    return activeProvider.COVER.replace("{sid}", sid);
}

function getInfoUrl(sid) {
    return activeProvider.API_INFO.replace("{sid}", sid);
}

function getInfoUrlV2(sid) {
    return activeProvider.API_INFO.replace("{sid}", sid);
}

// 4. Hardcoded Fetch Patch for osu.direct
if (activeProvider.name === "osu.direct") {
    (function patchFetchForOsuDirect() {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const url = args[0] instanceof Request ? args[0].url : args[0];
            if (typeof url === "string" && url.includes("osu.direct/api/v2/")) {
                const response = await originalFetch.apply(this, args);
                const originalJson = response.json.bind(response);
                response.json = async () => {
                    const data = await originalJson();
                    // Adapter: Search results
                    if (data.beatmapsets) {
                        return { data: data.beatmapsets.map(set => ({ 
                            sid: set.id, title: set.title, artist: set.artist, creator: set.creator, approved: set.ranked 
                        }))};
                    }
                    // Adapter: Beatmap info
                    if (data.id) {
                        return { status: 0, data: Object.assign(data.beatmaps.map(b => ({ 
                            bid: b.id,
                            version: b.version,
                            star: b.difficulty_rating,
                            mode: b.mode_int,
                            length: b.total_length,
                            BPM: data.bpm,
                            creator: data.creator
                        })), { sid: data.id, title: data.title, artist: data.artist, creator: data.creator, approved: data.ranked })};
                    }
                    return data;
                };
                return response;
            }
            return originalFetch.apply(this, args);
        };
    })();
}
