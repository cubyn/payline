import * as soap from "soap";
import * as _debug from "debug";
import {
    ACTIONS,
    CURRENCIES,
    DEFAULT_ENDPOINTS_PREFIX,
    DEFAULT_WSDLS_PREFIX,
    DEFAULT_WSDLS_NAME,
    MIN_AMOUNT,
    Operation,
    OperationsProperty,
    EnvironmentsProperty,
    paylineDate,
    paylineNow,
} from "./model";


const debug = _debug("payline");


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

function generateId() {
    return `${Math.ceil(Math.random() * 100000)}`;
}


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

    private extractResult(result: any): any {
        return result.result || result;
    }

    private async _runAction(client: any, action: string, args: any): Promise<any> {
        const response = await new Promise<any>((resolve, reject) => {
            try {
                client[action](args, resolve);
            } catch (error) {
                reject(error);
            }
        });
        const result = this.extractResult(response);

        if (this.isResultSuccessful(result)) {
            return { result: result, raw: response };
        } else {
            throw { result: result, raw: response };
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
        return { walletId: result.wallet, raw: result };
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
        return { walletId: result.wallet, raw: result };
    }

    public async doWalletPayment(walletId, amount, currency = CURRENCIES.EUR): Promise<any> {
        const result = await this.runAction("doImmediateWalletPayment", {
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
                date: paylineNow()
            },
            walletId
        });
        return { transactionId: result.transaction && result.transaction.id, raw: result };
    }

    public async doAuthorization(reference, card, tryAmount, currency = CURRENCIES.EUR): Promise<any> {
        const result = await this.runAction("doAuthorization", {
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
                date: paylineNow()
            },
            card: {
                attributes: ns('card'),
                number: card.number,
                type: card.type,
                expirationDate: card.expirationDate,
                cvx: card.cvx
            }
        });
        return { transactionId: result.transaction && result.transaction.id, raw: result };
    }

    public async doCapture(transactionID, tryAmount, currency = CURRENCIES.EUR): Promise<any> {
        const result = await this.runAction("doCapture", {
            payment: {
                attributes: ns('payment'),
                amount: tryAmount,
                currency,
                action: ACTIONS.VALIDATION,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            transactionID
        });
        return { transactionId: result.transaction && result.transaction.id, raw: result };
    }

    public async doReset(transactionID: string, comment: string = "Card validation cleanup"): Promise<any> {
        const result = await this.runAction("doReset", {
            transactionID,
            comment: comment,
        });
        return { transactionId: result.transaction && result.transaction.id, raw: result };
    }

    public async validateCard(card, tryAmount = 100, currency = CURRENCIES.EUR, referencePrefix: string = "order_"): Promise<any> {
        // 1 is the minimum here
        tryAmount = Math.max(tryAmount, MIN_AMOUNT);
        let authorization: any = null;
        try {
            authorization = await this.doAuthorization(`${referencePrefix}${generateId()}`, card, tryAmount, currency);
        } catch {
            return {success: false, raw: {authorization, reset: null}};
        }

        const reset = await this.doReset(authorization && authorization.transactionId);
        return { success: true, raw: {authorization, reset} }
    }

    public async doWebPayment(amount, ref, date, returnURL, cancelURL, currency = CURRENCIES.EUR): Promise<any> {
        const result = await this.runAction("doWebPayment", {
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
        });
        return { transactionId: result.transaction && result.transaction.id, raw: result };
    }
}
