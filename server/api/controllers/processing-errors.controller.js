/*
 * @license
 * (c) Copyright 2019 | MY-D Foundation | Created by Matthew Moy de Vitry
 * Use of this code is governed by the GNU Affero General Public License (https://www.gnu.org/licenses/agpl-3.0)
 * and the profit contribution agreement available at https://www.my-d.org/ProfitContributionAgreement
 */

// Created for proximap#206

import _ from "lodash"
import l from "../../common/logger"

export function extractProcessingErrors(fountainCollection){
  // returns collection of processing errors from collection
  if(process.env.NODE_ENV !== 'production') {
    l.info('processing-errors.controller.js extractProcessingErrors: start '+new Date().toISOString());
  }  
  let errorCollection = [];
  // loop through all fountains
  for(let fountain of fountainCollection.features){
    // loop through all properties
    _.forIn(fountain.properties, (p, key)=>{
      if(p.hasOwnProperty('issues') && p.issues.length > 0){
        p.issues.forEach(issue=>{
          // create copy
          let error = _.cloneDeep(issue);
          // append error to collection
          errorCollection.push(error);
        });
      }
    });
  }
  l.info('processing-errors.controller.js extractProcessingErrors: found '+errorCollection.length+' processing errors '+new Date().toISOString());  
  return errorCollection;
}