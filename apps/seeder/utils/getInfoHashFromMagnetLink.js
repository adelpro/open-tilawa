export default function getInfoHashFromMagnetLink(magnet){
    const match = magnet.match(/btih:([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
} 