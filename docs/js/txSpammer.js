/**
 * Created by Peter Ryszkiewicz (https://github.com/pRizz) on 9/10/2017.
 * https://github.com/pRizz/iota.transactionSpammer.js
 */

var txSpammer = {
    // Providers are fetched to keep them dynamic and load balance the network.
    // If the owner of a public node does not want to be in the list, they can notify me to remove them.
    providersUrl: "https://gpanosxp.github.io/IOTA-SpammerXP/providers.json",
    httpProviders: [],
    httpsProviders: [],
    validProviders: [],

    // Transaction-related data
    spamSeed: "",
    hostingSite: 'https://github.com/GpanosXP/IOTA-SpammerXP',
    tag: "SEE9SITE9IN9MESSAGE",
    message: "",
    transfersPerBundle: 1,
    weight: 15,

    // Events
    eventEmitter: new EventEmitter(),

    // Workers
    workers: [],
    workingCounter: 0,

    // Enums and misc
    stateTypes: {
        None:        0,
        Info:        1,
        Error:      -1,
        Local:       2,
        LocalError: -2,
        Net:         3,
        NetError:   -3,
        Start:       4,
        Stop:       -4
    }
};

/// General/Helper Functions

    // WARNING: Not a perfect tritifier for URL's - only handles a few special characters
    txSpammer.tritifyURL = function(url)
    {
        return url.replace(/:/gi, 'COLON').replace(/\./gi, 'DOT').replace(/\//gi, 'SLASH').replace(/-/gi, 'DASH').toUpperCase();
    };

    // Returns a depth in [4, 12] inclusive
    txSpammer.generateDepth = function()
    {
        return Math.floor(Math.random() * (12 - 4 + 1)) + 4;
    }

    // Returns a valid somewhat-random seed (not secure for non-zero value use !)
    txSpammer.generateSeed = function()
    {
        const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ9';
        return Array.from(new Array(81), (x, i) => validChars[Math.floor(Math.random() * validChars.length)]).join('');
    }

    txSpammer.generateTransfers = function()
    {
        return Array.from(new Array(txSpammer.transfersPerBundle), (x, i) => {
            return {
                address: txSpammer.spamSeed,
                tag: txSpammer.tag,
                message: txSpammer.message,
                value: 0
            }
        });
    };

/// Events

    txSpammer.emitState = function(id, message)
    {
        this.eventEmitter.emitEvent('state', ["Worker " + id + ": " + message]);
    }
    txSpammer.emitError = function(id, message)
    {
        this.eventEmitter.emitEvent('state', ["Error by worker " + id + ": " + message]);
        console.log(message);

        this.replaceWorker(id).then((newWorker) => newWorker.startSpamming());
    }
    txSpammer.emitWorking = function(id, isWorking)
    {
        if (isWorking) this.workingCounter++;
        else this.workingCounter--;
        if (this.workingCounter < 0) this.workingCounter = 0;

        this.eventEmitter.emitEvent('working', [this.workingCounter]);
    }

/// Providers

    txSpammer.getRandomProvider = function()
    {
        // TODO: rank providers by average response time
        return this.validProviders[Math.floor(Math.random() * this.validProviders.length)];
    }

    txSpammer.getValidProviders = function()
    {
        // Web browser polices enforce the use of https when the website is accessed by https too.
        if (window.location.protocol == "https") return this.httpsProviders;
        else return this.httpProviders.concat(this.httpsProviders);
    }

    txSpammer.fetchProviders = function(callback)
    {
        return $.ajax({ url: this.providersUrl }).done((reply) => {
            if (!reply) return;
            if (reply.http) this.httpProviders = reply.http;
            if (reply.https) this.httpsProviders = reply.https;

            this.validProviders = this.getValidProviders();
            if (callback) this.callback();
        });
    }

/// Worker pool

    txSpammer.addWorker = function()
    {
        var id = this.workers.length;
        this.workers.push(undefined);
        return this.createWorker(id);
    }

    txSpammer.removeWorker = function()
    {
        var id = this.workers.length - 1;
        if (id < 0) return false

        return this.workers[id].stopSpamming().then((claimedID) => this.workers.pop());
    }

    txSpammer.createWorker = function(id)
    {
        if (!(id < this.workers.length) || this.workers[id]) return false;

        const newWorker = new this.worker(id, this.getRandomProvider());
        this.workers[id] = newWorker;
        return newWorker;
    }

    txSpammer.replaceWorker = function(id)
    {
        if (!(id < this.workers.length)) return false;

        return new Promise((resolve, reject) => {
            if (this.workers[id]) {
                this.workers[id].stopSpamming().then((claimedID) => {

                    this.workers[id] = undefined; // delete old worker
                    resolve(this.createWorker(id));
                });
            }
            else resolve(this.createWorker(id));
        });
    }

    // Tells all workers to stop and returns a promise
    // that is resolved when all workers have stopped.
    txSpammer.stopAll = function()
    {
        const count = this.workers.length;

        var promises = new Array(count);
        for (var i = 0; i < count; i++) promises[i] = this.workers[i].stopSpamming();

        return Promise.all(promises);
    }

/// Worker
txSpammer.worker = function(myID, myProvider)
{
    this.ID = myID;
    this.provider = myProvider;
    this.iota;

    this.running = false;

    this.stopPromise;
    this.stopPromiseResolve;

    // Call this when the worker has stopped
    this.stopped = function()
    {
        if (!this.stopPromise) return;

        this.stopPromise = undefined;
        this.stopPromiseResolve(myID);
    }

    this.emitState = function(type, message)
    {
        // Do something with Date.now()
        txSpammer.emitState(myID, message);
    }
    this.emitError = function(message)
    {
        this.running = false;

        txSpammer.emitWorking(false);
        txSpammer.emitError(myID, message);

        this.stopped();

        return false; // Return a "negative" signal
    }
    this.emitWorking = function(message)
    {
        txSpammer.emitWorking(myID, message);
    }

    this.startSpamming = function()
    {
        if (this.running) return;
        this.running = true;
        this.emitState(txSpammer.stateTypes.Start, "Started transaction spamming.");

        this.initializeIOTA() &&
        this.syncAndSend();
    };
    this.stopSpamming = function()
    {
        if (!this.running) return Promise.resolve(myID);

        this.running = false;

        if (!this.stopPromise) this.stopPromise = new Promise((resolve) => this.stopPromiseResolve = resolve);

        return this.stopPromise;
    };
    this.restartSpamming = function()
    {
        this.stopSpamming().then(() => this.startSpamming());
    };
    this.finished = function()
    {
        if (this.running) this.syncAndSend();
        else {
            this.emitState(txSpammer.stateTypes.Stop, "Stopped transaction spamming.");
            this.stopped();
        }
    };

    this.initializeIOTA = function()
    {
        this.emitState(txSpammer.stateTypes.Info, "Initializing IOTA library.");

        this.iota = new IOTA({'provider': myProvider});
        curl.overrideAttachToTangle(this.iota.api);

        return this.iota;
    };

    this.syncAndSend = function()
    {
        this.emitState(txSpammer.stateTypes.Net, "Checking if node is synced: " + myProvider);

        return this.iota.api.getNodeInfo((error, success) => this.nodeSyncResponse(error, success));
    };
    this.nodeSyncResponse = function(error, success)
    {
        if (error) return this.emitError("Unknown error while checking if node is synced.");

        const synced = !(
            success.latestMilestone == txSpammer.spamSeed ||
            success.latestSolidSubtangleMilestone == txSpammer.spamSeed ||
            success.latestSolidSubtangleMilestoneIndex < success.latestMilestoneIndex
        );
        if (!synced) return this.emitError("Node is not synced.");

        this.sendTx();
    };

    this.sendTx = function()
    {
        const transfers = txSpammer.generateTransfers();

        this.emitState(txSpammer.stateTypes.Net, "Requesting transactions to create confirmations for.");

        this.iota.sendTransfer3steps(txSpammer.spamSeed, txSpammer.generateDepth(), txSpammer.weight, transfers, {},
            // After getting tx to approve
            (error, success) => {
                if (error) return this.emitError("Error while getting transactions.");

                this.emitState(txSpammer.stateTypes.Local, "Performing PoW (Proof of Work)");
                this.emitWorking(true);
            },
            // After calculating PoW
            (error, success) => {
                if (error) return this.emitError("Error while attaching transactions.");

                this.emitState(txSpammer.stateTypes.Net, "Completed PoW (Proof of Work), broadcasting confirmations.");
                this.emitWorking(false);
            },
            // After the confirmations have been broadcast
            (error, success) => {
                if (error) return this.emitError("Error while attaching transactions.");

                this.emitState(txSpammer.stateTypes.Info, "Broadcast completed.");
                txSpammer.eventEmitter.emitEvent('transactionCompleted', [success]);
                this.finished();
            }
        );
    };
};

/// Initialization

    txSpammer.Init = function()
    {
        this.spamSeed = this.generateSeed();
        this.message = this.tritifyURL(this.hostingSite);
        return this.fetchProviders();
    };
