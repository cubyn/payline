import * as soap from "soap";
import * as _debug from "debug";
import {
    DEFAULT_ENDPOINTS_PREFIX,
    DEFAULT_WSDLS_NAME,
    DEFAULT_WSDLS_PREFIX,
    Environment,
    EnvironmentsProperty,
    Operation,
    OperationsProperty,
} from "./model";


const debug = _debug("payline");

export class PaylineCore {

    public paylineVersion: string = "18";

    private _soapClient: OperationsProperty<any | null> = {
        directPayment: null,
        webPayment: null,
        extended: null,
    };

    constructor(private merchantId: string, private accessKey: string, public contractNumber: string,
                public enviromnent: Environment,
                public endpointsPrefix: EnvironmentsProperty<string> = DEFAULT_ENDPOINTS_PREFIX,
                public wsdlsPrefix: EnvironmentsProperty<string> = DEFAULT_WSDLS_PREFIX,
                public wsdlsName: OperationsProperty<string> = DEFAULT_WSDLS_NAME,) {
        debug("Created Payline object");
    }

    /**
     * Call any action that is defined in the WSDL files with the arguments
     * @param {string} action name of the action to call
     * @param args parameters of the call
     * @return {<any>} promise of the response from payline
     */
    public async runAction(action: string, args: any): Promise<any> {
        await this.initializeAll();
        const client = Object.keys(this._soapClient)
            .map(clientName => this._soapClient[clientName])
            .find(client => !!client && !!client[this.actionMethodName(action)]);
        if (!client) {
            throw new Error("Wrong action for the API");
        } else {
            debug(`Using client with services ` +
                `${JSON.stringify(Object.keys(client && client.wsdl && client.wsdl.services))} for action ${action}`);
        }

        try {
            return this._runAction(client, action, args);
        } catch (error) {
            const response = error.response;
            if (response.statusCode === 401) {
                return Promise.reject({shortMessage: "Wrong API credentials", paylineError: error});
            } else {
                return Promise.reject({shortMessage: "Wrong API call", paylineError: error});
            }
        }
    }

    protected wsdl(operation: Operation): string {
        return `${this.wsdlsPrefix[this.enviromnent]}${this.wsdlsName[operation]}`;
    }

    protected soapParams(operation: Operation): { [key: string]: any } {
        return {
            endpoint: `${this.endpointsPrefix[this.enviromnent]}${this.serviceNameFromWsdl(this.wsdlsName[operation])}`,
        };
    }

    private serviceNameFromWsdl(wsdlName: string) {
        return wsdlName.substr(0, wsdlName.length - ".wsdl".length);
    }

    private async initializeAll(): Promise<void> {
        await Promise.all(Object.keys(this._soapClient).map((operation: Operation) =>
            (!this._soapClient[operation]) ? this.initialize(operation) : Promise.resolve()));
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
        debug("creating client for", operation, this.wsdl(operation));
        this._soapClient[operation] = await soap.createClientAsync(this.wsdl(operation), this.soapParams(operation));
        const basicAuthSecurity = new soap.BasicAuthSecurity(this.merchantId, this.accessKey);

        this._soapClient[operation].setSecurity(basicAuthSecurity);
        this._soapClient[operation].on("request", (xml: string): void => {
            debug("REQUEST", xml);
        });
        this._soapClient[operation].on("response", (xml: string): void => {
            debug("RESPONSE", xml);
        });
    }

    private isResultSuccessful(result: any): boolean {
        return result && ["02500", "00000"].includes(result.code);
    }

    private extractResult(result: any): any {
        return result && result.result || result;
    }

    /**
     * soap library has trouble loading element types
     * so we sometimes have to override inferred namespace
     * @param type
     * @returns {{xsi_type: {type: any; xmlns: string}}}
     */
    private namespace(type: string): any {
        return {
            xsi_type: {
                type,
                xmlns: "http://obj.ws.payline.experian.com",
            }
        };
    }

    private paylineDate(date: Date): String {
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString(); // getMonth() is zero-based
        const day = date.getDate().toString();
        const hour = date.getHours().toString();
        const minute = date.getMinutes().toString();
        // DD/MM/YYYY HH:mm
        return `${(day[1] ? day : `0${day[0]}`)}/` +
            `${(month[1] ? month : `0${month[0]}`)}/` +
            `${year} ${(hour[1] ? hour : `0${hour[0]}`)}:${(minute[1] ? minute : `0${minute[0]}`)}`;
    };

    private paylineShortDate(date: Date): String {
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString(); // getMonth() is zero-based
        const day = date.getDate().toString();
        // DD/MM/YYYY
        return `${(day[1] ? day : `0${day[0]}`)}/` +
            `${(month[1] ? month : `0${month[0]}`)}/` +
            `${year}`;
    }

    private ensureAttributes(args: any): any {
        Object.keys(args)
            .filter(name => name !== "attributes" && !!args[name])
            .forEach(name => {
                if (args[name].constructor === Object) {
                    // adding too much namesapces in the same node
                    //args[name].attributes = args[name].attributes || this.namespace(name);
                    args[name] = this.ensureAttributes(args[name]);
                }
                if (args[name].constructor === Array) {
                    args[name].forEach(this.ensureAttributes.bind(this));
                }
                if (["expirationDate", "date", "issueCardDate"].includes(name) && !(args[name] instanceof Date) &&
                    !isNaN(Date.parse(args[name]))) {
                    args[name] = new Date(args[name]);
                }
                if (name === "expirationDate" && args[name] instanceof Date) {
                    const year = args[name].getFullYear().toString();
                    const month = (args[name].getMonth() + 1).toString(); // getMonth() is zero-based
                    debug("expiration date", args[name].getFullYear().toString(), (args[name].getMonth() + 1).toString())
                    args[name] = `${(month[1] ? month : `0${month[0]}`)}${year.slice(-2)}`;
                }
                if (name === "expirationDate") {
                    args[name] = args[name].replace("/", ""); // replace 12/07 to 1207
                }
                if (name === "scheduledDate" && args[name] instanceof Date) {
                    args[name] = this.paylineShortDate(args[name]);
                }
                if (args[name] instanceof Date) {
                    args[name] = this.paylineDate(args[name]);
                }
                if (name === "amout" && args[name] instanceof Number) {

                }
            });
        return args;
    }

    private actionMethodName(action: string): string {
        return `${action}Async`;
    }

    private async _runAction(client: any, action: string, args: any): Promise<any> {
        //args.version = args.version || this.paylineVersion;
        const _args: any = this.ensureAttributes(args);
        const response = await client[this.actionMethodName(action)](_args);
        const result = this.extractResult(response);
        debug(`action ${action} got result ${JSON.stringify(result)} from response ${JSON.stringify(response)}`);

        if (this.isResultSuccessful(result)) {
            return response;
        } else {
            throw response;
        }
    }
}
