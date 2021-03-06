/*
 * @license
 * (c) Copyright 2019 | MY-D Foundation | Created by Matthew Moy de Vitry
 * Use of this code is governed by the GNU Affero General Public License (https://www.gnu.org/licenses/agpl-3.0)
 * and the profit contribution agreement available at https://www.my-d.org/ProfitContributionAgreement
 */

import Express from 'express';
import * as path from 'path';
import * as bodyParser from 'body-parser';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerify from './swagger';
import l from './logger';
import fs from 'fs';
import buildInfo from './build.info';
import logIncomingRequests from "../middleware/log.incoming";

let privateKey = '';
let certificate = '';
let port = '';

if(process.env.NODE_ENV === 'production') {
  // When running in production mode, read private key and certificate for encryption
  privateKey = fs.readFileSync('privatekey.pem');
  certificate = fs.readFileSync('certificate.pem');
  // use port 3001 running the stable branch, otherwise use port 3000
  port = buildInfo.branch==='stable'?3001:3000;
}else{
  // if not running in production, then use the port as defined in the .env file
  port = process.env.PORT;
}

const app = new Express();

export default class ExpressServer {
  constructor() {
    const root = path.normalize(`${__dirname}/../..`);
    app.set('appPath', `${root}client`);
    app.use(cors()); // allow cross-origin requests
    app.use(helmet()); // helmet helps secure Express apps with appropriate HTTP headers
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser(process.env.SESSION_SECRET)); // sign cookies. not sure what benefit is. See https://github.com/expressjs/cookie-parser
    app.use(logIncomingRequests(l)); // log all incoming requests for debugging
    app.use(Express.static(`${root}/public`));
    
  }

  // swaggerify uses the api definition in common/swagger/Api.yml to configure api endpoints
  router(routes) {
    swaggerify(app, routes);
    return this;
  }
  
    listen() {
    const welcome = p => () => l.info(`server.js: up and running in ${process.env.NODE_ENV || 'development'} @: ${os.hostname()} on port: ${p}}`);
    if(process.env.NODE_ENV === 'production'){
      https.createServer({
        key: privateKey,
        cert: certificate
      }, app).listen(port, welcome(port));
      return app;
    }else{
      http.createServer(app).listen(port, welcome(port));
      return app;
    }
  }
}
