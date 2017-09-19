// Iota api extensions
// Copied from iota.api.js and modified to add features.

/// sendTransfer in 3 steps

    IOTA.prototype.sendTransfer3steps = function(seed, depth, minWeightMagnitude, transfers, options, callback1, callback2, callback3)
    {
        // Copy of iota.api.sendTransfer, but with 2 extra parameters (callback2, callback3),
        // and using sendTrytes3steps instead of iota.api.sendTrytes.
        // To avoid potential errors, the parameter 'options' is mandatory,
        // unlike the original sendTransfer, where it could be omitted.
        // If no 'options' are present, simply use {} as 'options' when calling.
        var self = this;

        // Validity check for number of arguments
        if (arguments.length != 8) {
            return callback1(new Error("Invalid number of arguments"));
        }

        // Check if correct depth and minWeightMagnitude
        // inputValidator <-> self.valid
        if (!self.valid.isValue(depth) || !self.valid.isValue(minWeightMagnitude)) {

            return callback(errors.invalidInputs());
        }

        self.api.prepareTransfers(seed, transfers, options, function(error, trytes) {

            if (error) {
                return callback1(error)
            }

            self.sendTrytes3steps(trytes, depth, minWeightMagnitude, callback1, callback2, callback3);
        })
    };

    IOTA.prototype.sendTrytes3steps = function(trytes, depth, minWeightMagnitude, callback1, callback2, callback3)
    {
        // Does exactly what iota.api.sendTrytes() does, but in three steps:
        // First, it gets the transactions to approve without attaching to tangle (i.e. without doing PoW), and calls callback1.
        // Second, it attaches to the Tangle (does PoW) and calls callback2.
        // Finally, it broadcasts the confirmations (PoW) and returns with callback3.
        // This allows for other tasks (logging, resource management, etc) to be done by callback1,
        // just before starting the (computationally expensive) PoW calculation.
        // And by measuring the difference in time between the callbacks,
        // we can get a good measurement of the time the network calls and PoW take.

        var self = this;

        // Inputs already ok, because we are called by sendTransfer3steps().

        // Get branch and trunk
        self.api.getTransactionsToApprove(depth, function(error, toApprove) {

            if (error) {
                return callback1(error)
            }

            callback1(null, toApprove);

            // attach to tangle - do pow
            self.api.attachToTangle(toApprove.trunkTransaction, toApprove.branchTransaction, minWeightMagnitude, trytes, function(error, attached) {

                if (error) {
                    return callback2(error)
                }

                callback2(null, attached);

                // Broadcast and store tx
                self.api.storeAndBroadcast(attached, function(error, success) {

                    if (error) {
                        return callback3(error);
                    }

                    var finalTxs = [];

                    attached.forEach(function(trytes) {
                        finalTxs.push(self.utils.transactionObject(trytes)); // utils <-> self.utils
                    })

                    return callback3(null, finalTxs);
                })
            })
        })
    };

/// Same as the above, but with all steps given as promises

    // Prepare transfers and get transactions to approve
    IOTA.prototype.sendTxStep1 = function(seed, depth, minWeightMagnitude, transfers, options)
    {
        var self = this;
        options = options || {};

        const inputsValid = arguments.length >= 4 && self.valid.isValue(depth) && self.valid.isValue(minWeightMagnitude);
        if (!inputsValid) return Promise.reject();

        return new Promise((resolve, reject) => {
            self.api.prepareTransfers(seed, transfers, options, function(error, trytes)
            {
                if (error) return reject(error);

                self.api.getTransactionsToApprove(depth, function(error, toApprove)
                {
                    if (error) return reject(error);

                    resolve(self, toApprove, minWeightMagnitude, trytes);
                });
            });
        });
    };

    // Attach to tangle
    IOTA.prototype.sendTxStep2 = function(toApprove, minWeightMagnitude, trytes)
    {
        return new Promise((resolve, reject) => {
            self.api.attachToTangle(toApprove.trunkTransaction, toApprove.branchTransaction, minWeightMagnitude, trytes, function(error, attached)
            {
                if (error) return reject(error)

                resolve(self, attached);
            });
        });
    };

    // Broadcast transaction
    IOTA.prototype.sendTxStep3 = function(attached)
    {
        return new Promise((resolve, reject) => {
            self.api.storeAndBroadcast(attached, function(error, success)
            {
                if (error) return reject(error);

                var finalTxs = [];
                attached.forEach((trytes) => finalTxs.push(self.utils.transactionObject(trytes)));

                resolve(self, finalTxs);
            });
        });
    };
