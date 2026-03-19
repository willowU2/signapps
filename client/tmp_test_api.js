const https = require('https');

https.get('https://fonts.google.com/metadata/fonts', (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            // Remove the first 5 characters which are ")]}'\n"
            const cleanedData = rawData.substring(5);
            const parsedData = JSON.parse(cleanedData);
            console.log(`Successfully fetched ${parsedData.familyMetadataList.length} fonts!`);
            console.log('Sample of 3 fonts:', parsedData.familyMetadataList.slice(0, 3).map(f => f.family));
        } catch (e) {
            console.error('Failed to parse:', e.message);
        }
    });
});
