import soap from 'soap';
import Promise from 'bluebird';
import debugLib from 'debug';
import path from 'path';
const debug = debugLib('payline');

const DEFAULT_WSDL = path.join(__dirname, 'WebPaymentAPI.v4.44.wsdl');
const MIN_AMOUNT = 100;
const ACTIONS = {
    AUTHORIZATION: 100,
    PAYMENT: 101, // validation + payment
    VALIDATION: 201
};

// soap library has trouble loading element types
// so we sometimes have to override inferred namespace
function ns(type) {
    return {
        'xsi_type': {
            type: type,
            xmlns: 'http://obj.ws.payline.experian.com'
        }
    };
}

const CURRENCIES = {
    EUR: 978,
    USD: 840,
    GBP: 826
};

export default class Payline {

    constructor(user, pass, contractNumber, wsdl = DEFAULT_WSDL) {
        if (!user || !pass || !contractNumber) {
            throw new Error('All of user / pass / contractNumber should be defined');
        }
        this.user = user;
        this.pass = pass;
        this.contractNumber = contractNumber;
        this.wsdl = wsdl;
    }

    initialize() {
        if (!this.__initializationPromise) {
            this.__initializationPromise = Promise.fromNode(callback => {
                    return soap.createClient(this.wsdl, {}, callback);
                })
                .then(client => {
                    client.setSecurity(new soap.BasicAuthSecurity(this.user, this.pass));
                    client.on('request', (xml) => {
                        debug('REQUEST', xml);
                    });
                    client.on('response', (xml) => {
                        debug('RESPONSE', xml);
                    });
                    return client;
                });
        }
        return this.__initializationPromise;
    }

    createOrUpdateWallet(walletId, card, update = false) {
        const wallet = {
            contractNumber: this.contractNumber,
            wallet: {
                attributes: ns('wallet'),
                walletId: walletId,
                card: card
            }
        };
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.createWallet(wallet, callback);
            }))
            .spread(({ result, response }) => {
                if (isSuccessful(result)) {
                    return { walletId: walletId };
                } else {
                    throw result;
                }
            }, parseErrors);
    }

    updateWallet(walletId, card) {
        return this.createOrUpdateWallet.apply(this, [ walletId, card, true ]);
    }

    createWallet(walletId, card) {
        return this.createOrUpdateWallet.apply(this, [ walletId, card, false ]);
    }

    getWallet(walletId) {
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.getWallet({
                    contractNumber: this.contractNumber,
                    walletId
                }, callback);
            }))
            .spread(({ result, wallet = null }, response) => {
                if (isSuccessful(result)) {
                    return wallet;
                } else {
                    throw result;
                }
            }, parseErrors);
    }

    makeWalletPayment(walletId, amount, currency = CURRENCIES.EUR) {
        const body = {
            payment: {
                attributes: ns('payment'),
                amount: amount,
                currency: currency,
                action: ACTIONS.PAYMENT,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            order: {
                attributes: ns('order'),
                ref: 'order_' + generateId(),
                amount: amount,
                currency: currency,
                date: formatNow()
            },
            walletId
        };
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doImmediateWalletPayment(body, callback);
            }))
            .spread(({ result, transaction = null }) => {
                if (isSuccessful(result)) {
                    return { transactionId: transaction.id };
                } else {
                    throw result;
                }
            }, parseErrors);
    }

    validateCard(card, tryAmount = 100, currency = CURRENCIES.EUR) {
        // 1 is the minimum here
        tryAmount = Math.max(tryAmount, MIN_AMOUNT);
        var client;
        return this.initialize()
            .then((c) => Promise.fromNode(callback => {
                client = c;
                client.doAuthorization({
                    payment: {
                        attributes: ns('payment'),
                        amount: tryAmount,
                        currency: currency,
                        action: ACTIONS.AUTHORIZATION,
                        mode: 'CPT',
                        contractNumber: this.contractNumber
                    },
                    order: {
                        attributes: ns('order'),
                        ref: 'order_' + generateId(),
                        amount: tryAmount,
                        currency: currency,
                        date: formatNow()
                    },
                    card: {
                        attributes: ns('card'),
                        number: card.number,
                        type: card.type,
                        expirationDate: card.expirationDate,
                        cvx: card.cvx
                    }
                }, callback);
            }))
            .spread(({ result, transaction = null }) => {
                if (isSuccessful(result)) {
                    return Promise.fromNode(callback => client.doReset({
                            transactionID: transaction.id,
                            comment: 'Card validation cleanup'
                        }, callback))
                        .return(true);
                } else {
                    return false;
                }
            }, parseErrors);
    }

    doAuthorization(reference, card, tryAmount, currency = CURRENCIES.EUR) {
        const body = {
            payment: {
                attributes: ns('payment'),
                amount: tryAmount,
                currency: currency,
                action: ACTIONS.AUTHORIZATION,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            order: {
                attributes: ns('order'),
                ref: reference,
                amount: tryAmount,
                currency: currency,
                date: formatNow()
            },
            card: {
                attributes: ns('card'),
                number: card.number,
                type: card.type,
                expirationDate: card.expirationDate,
                cvx: card.cvx
            }
        };
        return this.initialize()
                .then(client => Promise.fromNode(callback => {
                client.doAuthorization(body, callback);
            }))
            .spread(({ result, transaction = null }) => {
                if (isSuccessful(result)) {
                    return { transactionId: transaction.id };
                } else {
                    throw result;
                }
            }, parseErrors);
    }

    doCapture(transactionID, tryAmount, currency = CURRENCIES.EUR) {
        const body = {
            payment: {
                attributes: ns('payment'),
                amount: tryAmount,
                currency: currency,
                action: ACTIONS.VALIDATION,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            transactionID: transactionID
        };
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doCapture(body, callback);
            }))
            .spread(({ result, transaction = null }) => {
                if (isSuccessful(result)) {
                    return { transactionId: transaction.id };
                } else {
                    throw result;
                }
            }, parseErrors);
    }

    doWebPayment(amount, ref, date, returnURL, cancelURL, currency = CURRENCIES.EUR) {

        var body = {
            payment: {
                attributes: ns('payment'),
                amount: amount,
                currency: currency,
                action: ACTIONS.PAYMENT,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            returnURL: returnURL,
            cancelURL: cancelURL,
            order: {
                attributes: ns('order'),
                ref: ref,
                amount: amount,
                currency: currency,
                // Format : 20/06/2015 20:21
                date: date
            },
            selectedContractList: null,
            buyer: {}
        };

        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doWebPayment(body, callback);
            }))
            .spread(response => {
                if (isSuccessful(response.result)) {
                    return response;
                } else {
                    throw result;
                }
            }, parseErrors);
    }
}

Payline.CURRENCIES = CURRENCIES;

function parseErrors(error) {
    const response = error.response;
    if (response.statusCode === 401) {
        return Promise.reject({shortMessage: 'Wrong API credentials'});
    } else {
        return Promise.reject({shortMessage: 'Wrong API call'});
    }
}

function generateId() {
    return '' + Math.ceil(Math.random() * 100000);
}

function isSuccessful(result) {
    return result && ['02500', '00000'].indexOf(result.code) !== -1;
}

function formatNow() {
    var now = new Date();
    var year = now.getFullYear().toString();
    var month = (now.getMonth() + 1).toString(); // getMonth() is zero-based
    var day = now.getDate().toString();
    var hour = now.getHours().toString();
    var minute = now.getMinutes().toString();
    // DD/MM/YYYY HH:mm
    return (day[1] ? day : '0' + day[0]) + '/' + (month[1] ? month : '0' + month[0]) + '/' + year +
        ' ' + (hour[1] ? hour : '0' + hour[0]) + ':' + (minute[1] ? minute : '0' + minute[0]);
}
