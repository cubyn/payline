import * as soap from "soap";
import * as _debug from "debug";
import * as path from "path";


const debug = _debug("payline");

export const enum Environment { homologation = "homologation", production = "production" };
export const enum Operation { webPayment = "webPayment", directPayment = "directPayment", extended = "extended" };

export type EnvironmentsProperty<T> = {[key in Environment]:T};
export type OperationsProperty<T> = {[key in Operation]:T};


const DEFAULT_ENDPOINTS_PREFIX: EnvironmentsProperty<string> = {
    homologation: "https://homologation.payline.com/V4/services/",
    production: "https://services.payline.com/V4/services/",
};

const DEFAULT_WSDLS_PREFIX: EnvironmentsProperty<string> = {
    homologation: path.join(__dirname, "wsdl/homologation") + "/",
    production: path.join(__dirname, "wsdl/production") + "/",
};

const DEFAULT_WSDLS_NAME: OperationsProperty<string> = {
    webPayment: "WebPaymentAPI.wsdl",
    directPayment: "DirectPaymentAPI.wsdl",
    extended: "ExtendedAPI.wsdl",
};

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
        xsi_type: {
            type,
            xmlns: 'http://obj.ws.payline.experian.com'
        }
    };
}

const CURRENCIES = {
    EUR: 978,
    USD: 840,
    GBP: 826
};

class PaylineCore {

    private _soapClient: OperationsProperty<any | null> = {
        directPayment: null,
        webPayment: null,
        extended: null,
    };

    constructor(private merchantId: string, private accessKey: string, public contractNumber: string,
                public enviromnent: Operation,
                public endpointsPrefix: EnvironmentsProperty<string> = DEFAULT_ENDPOINTS_PREFIX,
                public wsdlsPrefix: EnvironmentsProperty<string> = DEFAULT_WSDLS_PREFIX,
                public wsdlsName: OperationsProperty<string> = DEFAULT_WSDLS_NAME,) {
    }

    protected wsdl(): string {
        return "";
    }

    protected soapParams(): {} {
        return {};
    }

    private async initializeAll(): Promise<void> {
        Object.keys(this._soapClient).forEach((operation: Operation) => {
            if (!this._soapClient[operation]) {
                this.initialize(operation);
            }
        });
    }

    /**
     * Initialize the SOAP client as a singleton by:
     * - getting WSDL files
     * - generating clinet object from WSDL files
     * - setting basic auth on the soap
     * - adding debug for the operations using debug lib with payline key
     * @return {Promise<any>} promise to the soap client
     */
    private async initialize(operation: Operation): Promise<void> {
        this._soapClient[operation] = await soap.createClientAsync(this.wsdl(), this.soapParams());
        const basicAuthSecurity = new soap.BasicAuthSecurity(this.merchantId, this.accessKey);

        this._soapClient[operation].setSecurity(basicAuthSecurity);
        this._soapClient[operation].on('request', (xml: string): void => {
            debug('REQUEST', xml);
        });
        this._soapClient[operation].on('response', (xml: string): void => {
            debug('RESPONSE', xml);
        });
    }

    private isResultSuccessful(result: any): boolean {
        return result && ['02500', '00000'].indexOf(result.code) !== -1;
    }

    private async _runAction(client: any, action: string, args: any): Promise<any> {
        const { result, response } = await new Promise<any>((resolve, reject) => {
            try {
                client[action](args, resolve);
            } catch (error) {
                reject(error);
            }
        });

        if (this.isResultSuccessful(result)) {
            return result;
        } else {
            throw result;
        }
    }

    /**
     * Call any action that is defined in the WSDL files with the arguments
     * @param {string} action name of the action to call
     * @param args parameters of the call
     * @return {<any>} promise of the response from payline
     */
    public async runAction(action: string, args: any): Promise<any> {
        await this.initializeAll();
        const client = Object.values(this._soapClient)
            .find(client => !!client && !!client[action]);

        if (!!client) {
            throw new Error("Wrong action for the API");
        }

        try {
            return this._runAction(client, action, args);
        } catch (error) {
            const response = error.response;
            if (response.statusCode === 401) {
                return Promise.reject({ shortMessage: "Wrong API credentials", paylineError: error });
            } else {
                return Promise.reject({ shortMessage: "Wrong API call", paylineError: error });
            }
        }
    }

}

export default class Payline extends PaylineCore {

    private async createOrUpdateWallet(walletId, card, update = false): Promise<any> {
        const wallet = {
            contractNumber: this.contractNumber,
            wallet: {
                attributes: ns('wallet'),
                walletId,
                card
            }
        };

        const result = await this.runAction("createWallet", wallet);
        return { walletId, raw: result };
    }

    public async updateWallet(walletId, card): Promise<any> {
        return this.createOrUpdateWallet(walletId, card, true);
    }

    public async createWallet(walletId, card): Promise<any> {
        return this.createOrUpdateWallet(walletId, card, false);
    }

    public async getWallet(walletId): Promise<any> {
        const result = await this.runAction("getWallet", {
            contractNumber: this.contractNumber,
            walletId
        });
        return { walletId, raw: result };

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
                }

                throw result;
            }, parseErrors);
    }

    makeWalletPayment(walletId, amount, currency = CURRENCIES.EUR) {
        const body = {
            payment: {
                attributes: ns('payment'),
                amount,
                currency,
                action: ACTIONS.PAYMENT,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            order: {
                attributes: ns('order'),
                ref: `order_${generateId()}`,
                amount,
                currency,
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
                }

                throw result;
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
                        currency,
                        action: ACTIONS.AUTHORIZATION,
                        mode: 'CPT',
                        contractNumber: this.contractNumber
                    },
                    order: {
                        attributes: ns('order'),
                        ref: `order_${generateId()}`,
                        amount: tryAmount,
                        currency,
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
                }

                return false;
            }, parseErrors);
    }

    doAuthorization(reference, card, tryAmount, currency = CURRENCIES.EUR) {
        const body = {
            payment: {
                attributes: ns('payment'),
                amount: tryAmount,
                currency,
                action: ACTIONS.AUTHORIZATION,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            order: {
                attributes: ns('order'),
                ref: reference,
                amount: tryAmount,
                currency,
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
                    }

                    throw result;
                }, parseErrors);
    }

    doCapture(transactionID, tryAmount, currency = CURRENCIES.EUR) {
        const body = {
            payment: {
                attributes: ns('payment'),
                amount: tryAmount,
                currency,
                action: ACTIONS.VALIDATION,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            transactionID
        };
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doCapture(body, callback);
            }))
            .spread(({ result, transaction = null }) => {
                if (isSuccessful(result)) {
                    return { transactionId: transaction.id };
                }

                throw result;
            }, parseErrors);
    }

    doWebPayment(amount, ref, date, returnURL, cancelURL, currency = CURRENCIES.EUR) {
        var body = {
            payment: {
                attributes: ns('payment'),
                amount,
                currency,
                action: ACTIONS.PAYMENT,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            returnURL,
            cancelURL,
            order: {
                attributes: ns('order'),
                ref,
                amount,
                currency,
                // Format : 20/06/2015 20:21
                date
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
                }

                throw response.result;
            }, parseErrors);
    }
}

Payline.CURRENCIES = CURRENCIES;

function generateId() {
    return `${Math.ceil(Math.random() * 100000)}`;
}

function formatNow() {
    var now = new Date();
    var year = now.getFullYear().toString();
    var month = (now.getMonth() + 1).toString(); // getMonth() is zero-based
    var day = now.getDate().toString();
    var hour = now.getHours().toString();
    var minute = now.getMinutes().toString();
    // DD/MM/YYYY HH:mm
    return `${(day[1] ? day : `0${day[0]}`)}/${(month[1] ? month : `0${month[0]}`)}/${year} ${(hour[1] ? hour : `0${hour[0]}`)}:${(minute[1] ? minute : `0${minute[0]}`)}`;
}
