const fs = require('fs');
const { exec } = require('child_process');
const puppeteer = require('puppeteer');

// Mapping of URL IDs to specific channel names required for the EPG
const channelNameMapping = {
    "hd-bnt-1-hd": "BNT1",
    "bnt-2": "BNT2",
    "hd-bnt-3-hd": "BNT3",
    "bnt-4": "BNT4",
    "hd-nova-tv-hd": "Nova",
    "hd-btv-hd": "bTV",
    "hd-btv-action-hd": "bTVAction",
    "btv-cinema": "bTVCinema",
    "btv-comedy": "bTVComedy",
    "btv-story": "bTVStory",
    "bulgaria-on-air": "BulgariaOnAir",
    "cartoon-network": "CartoonNetwork",
    "city-tv": "City",
    "hd-code-fashion-tv-hd": "CodeFashion",
    "diema-family": "DiemaFamily",
    "hd-diema-sport-hd": "DiemaSport",
    "hd-diema-sport-2-hd": "DiemaSport2",
    "hd-diema-sport-3-hd": "DiemaSport3",
    "diema": "Diema",
    "disney-channel": "Disney",
    "hd-discovery-channel-hd": "Discovery",
    "dstv": "DSTV",
    "e-kids": "EKids",
    "hd-epic-drama-hd": "EpicDrama",
    "hd-eurosport-1-hd": "Eurosport1",
    "hd-eurosport-2-hd": "Eurosport2",
    "euronews-bulgaria": "EuroNews",
    "evrokom": "Eurocom",
    "folklor-tv": "FolklorTV",
    "hd-food-network-hd": "FoodNetwork",
    "hd-star-crime-hd": "STARCrime",
    "hd-star-channel-hd": "STARChannel",
    "hd-star-life-hd": "STARLife",
    "hd-id-xtra-hd": "ID",
    "kanal-3": "Kanal3",
    "kino-nova": "KinoNova",
    "hd-max-sport-1-hd": "MAXSport1",
    "hd-max-sport-2-hd": "MAXSport2",
    "hd-max-sport-3-hd": "MAXSport3",
    "hd-max-sport-4-hd": "MAXSport4",
    "hd-nat-geo-hd": "NatGeo",
    "hd-nat-geo-wild-hd": "NatGeoWild",
    "nick-jr": "NickJr",
    "nickelodeon": "Nickelodeon",
    "nicktoons": "Nicktoons",
    "hd-nova-news-hd": "NovaNews",
    "hd-nova-sport-hd": "NovaSport",
    "planeta-folk": "PlanetaFolk",
    "hd-planeta-hd": "Planeta",
    "hd-ring-bg-hd": "RING",
    "rodina-tv": "Rodina",
    "hd-78-tv-hd": "78TV",
    "skat": "Skat",
    "the-voice": "TheVoice",
    "tiankov-tv": "TiankovFolk",
    "tlc": "TLC",
    "hd-travel-channel-hd": "TravelChannel",
    "travel-tv": "Travel",
    "tv-1": "TV1",
    "vtk": "VTK",
    "hd-24-kitchen-hd": "24kitchen",
    "alfa-tv": "Alfa",
    "axn": "AXN",
    "axn-black": "AXNBlack",
    "axn-white": "AXNWhite",
    "bloomberg-tv": "Bloomberg",
    // Add more mappings as needed
};

// Set to store recorded channels and avoid duplicates
const recordedChannels = new Set();

async function scrapeAndPushToGit() {
    // Clear the sources.m3u file before writing new data
    fs.writeFileSync('sources.m3u', '', 'utf-8');
    fs.appendFileSync('sources.m3u', "#EXTM3U\n", 'utf-8');
    recordedChannels.clear();
    
    // Launch a new browser instance with --no-sandbox flag
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Replace this URL with the URL of the page containing the links you want to scrape
    const url = 'https://www.seir-sanduk.com/bnt-1-hd-online';
    
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Extract all links from the page
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
                    .map(link => link.href)
                    .filter(href => href); // Filter out empty hrefs
    });

    for (let link of links) {
        try {
            await page.goto(link, { waitUntil: 'networkidle2' });

            const playerSource = await page.evaluate(() => {
                const scriptTags = document.querySelectorAll('script');
                let source = null;
                
                scriptTags.forEach(script => {
                    const scriptContent = script.innerHTML;
                    console.log(`Script Content: ${scriptContent}`);  // Log the script content
                    
                    if (scriptContent.includes('theVideoElement").')) {
                        const match = scriptContent.match(/file:\s*"([^"]+)"/);
                        if (match) {
                            source = match[1];
                        }
                    }
                });

                return source;
            });

            if (playerSource) {
                if (playerSource != "https://www.seir-sanduk.com/otustanausta1.mp4") {
                    // Extract the channel name from the URL (if it's part of the URL)
                    const channelId = link.split('id=')[1]?.split('&')[0] || 'Unknown Channel';

                    // Check the mapping for the correct channel name
                    const channelName = channelNameMapping[channelId] || channelId;
                    
                    // Skip "Unknown Channel" and duplicates
                    if (channelName !== 'Unknown Channel' && !recordedChannels.has(channelName)) {
                        const data = `#EXTINF:-1,${channelName}\n${playerSource}\n`;

                        fs.appendFileSync('sources.m3u', data, 'utf-8');
                        
                        console.log(`Data successfully written for ${channelName}`);
                        recordedChannels.add(channelName);  // Add to the set of recorded channels
                    } else if (channelName === 'Unknown Channel') {
                        console.log(`Skipped: ${channelName}`);
                    } else {
                        console.log(`Skipped duplicate channel: ${channelName}`);
                    }
                                       
                }
            } else {
                console.log(`player.source not found for ${link}`);
            }
        } catch (error) {
            console.error(`Error visiting ${link}: ${error.message}`);
        }
    }

    // Close the browser instance
    await browser.close();

    // Execute Git commands to add, commit, and push the changes
    exec('git add sources.m3u', (err, stdout, stderr) => {
        if (err) {
            console.error(`Error adding file: ${stderr}`);
            return;
        }

        exec('git commit -m "Update sources.m3u with new player sources"', (err, stdout, stderr) => {
            if (err) {
                console.error(`Error committing file: ${stderr}`);
                return;
            }

            exec('git push', (err, stdout, stderr) => {
                if (err) {
                    console.error(`Error pushing to repository: ${stderr}`);
                    return;
                }

                console.log('Changes successfully pushed to GitHub repository');
            });
        });
    });
}


// Export the function to be used in the server
module.exports = scrapeAndPushToGit;