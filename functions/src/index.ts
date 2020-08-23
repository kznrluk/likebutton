import * as functions from 'firebase-functions';
import * as admin from "firebase-admin";
import DocumentData = admin.firestore.DocumentData;
import DocumentReference = admin.firestore.DocumentReference;
import {IncomingHttpHeaders} from "http";

const CONFIG = {
    LIKE_CORRECTION: 'SITES',
    SITE_INFO: 'SITE_INFO'
}

admin.initializeApp(functions.config().firebase);
const firestore = admin.firestore();

type LikesInfo = {
    likes: number;
}

const getIp = (headers: IncomingHttpHeaders): string => {
    const ip = String(headers['x-forwarded-for']);
    if (!ip) throw Error('No fastly-client-ip');
    return ip;
}

const getPathRef = (url: URL): DocumentReference<DocumentData> => {
    return firestore
        .collection(CONFIG.SITE_INFO)
        .doc(url.hostname)
        .collection('paths')
        .doc(encodeURIComponent(url.pathname));
}

const createNewSiteInfo = (): LikesInfo => ({ likes: 0 })

const getLikesInfo = (url: URL): Promise<LikesInfo | undefined> => {
    return getPathRef(url)
        .get()
        .then(s => s.data()) as unknown as Promise<LikesInfo | undefined>;
}

const setPathInfo = (url: URL, likesInfo: LikesInfo) => {
    return getPathRef(url).set(likesInfo);
}

const addLog = (url: URL, ipAddr: string, isIncrease: boolean) => {
    return getPathRef(url)
        .collection('logs')
        .doc(ipAddr)
        .set({ createdAt: +(new Date()), isIncrease });
}

const isIncreasedIp = (url: URL, ipAddr: string) => {
    return getPathRef(url)
        .collection('logs')
        .doc(ipAddr)
        .get()
        .then(doc => doc.exists ? doc.data() : null) as unknown as { createdAt: number, isIncrease: boolean } | null;
}

// GET
export const get = functions.region('asia-northeast1').https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        // Send response to OPTIONS requests
        res.set('Access-Control-Allow-Methods', '*');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
    } else {
        if (req.method !== 'POST') {
            res.sendStatus(400);
        } else if (req.body.url) {
            try {
                const url = new URL(req.body.url);
                const pageInfo = await getLikesInfo(new URL(req.body.url)) ?? createNewSiteInfo();
                const isIncreased = await isIncreasedIp(url, getIp(req.headers));
                res.send({
                    likes: pageInfo.likes,
                    isIncreased: isIncreased?.isIncrease ?? false
                });
            } catch (e) {
                functions.logger.warn('Invalid Get Request', req);
                res.sendStatus(400);
            }
        } else {
            res.sendStatus(400);
        }
    }
});

// increase
export const increase = functions.region('asia-northeast1').https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        // Send response to OPTIONS requests
        res.set('Access-Control-Allow-Methods', '*');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.sendStatus(400);
    }

    if (req.body.url) {
        const url = new URL(req.body.url);

        if (!await isIncreasedIp(url, getIp(req.headers))?.isIncrease) {
            const likesInfo = await getLikesInfo(url) ?? createNewSiteInfo();

            await setPathInfo(url, {
                likes: likesInfo.likes + 1,
            });

            await addLog(url, getIp(req.headers), true);

            res.send({ result: 'OK' });
        }
    }

    res.sendStatus(400);
});

// decrease
export const decrease = functions.region('asia-northeast1').https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        // Send response to OPTIONS requests
        res.set('Access-Control-Allow-Methods', '*');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.sendStatus(400);
    }

    if (req.body.url) {
        const url = new URL(req.body.url);
        if (await isIncreasedIp(url, getIp(req.headers))?.isIncrease) {
            const likesInfo = await getLikesInfo(url) ?? createNewSiteInfo();

            await setPathInfo(url, {
                likes: likesInfo.likes + -1,
            });

            await addLog(url, getIp(req.headers), false);
            res.send({ result: 'OK' });
        }

    }

    res.sendStatus(400);
});
