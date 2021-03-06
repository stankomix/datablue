/*
 * @license
 * (c) Copyright 2019 - 20 | MY-D Foundation | Created by Matthew Moy de Vitry, Ralf Hauser
 * Use of this code is governed by the GNU Affero General Public License (https://www.gnu.org/licenses/agpl-3.0)
 * and the profit contribution agreement available at https://www.my-d.org/ProfitContributionAgreement
 */

import {getStaticStreetView} from "./google.service";

const _ = require ('lodash');
import WikimediaService from './wikimedia.service';
import WikipediaService from './wikipedia.service';
import WikidataService from './wikidata.service';
import l from '../../common/logger';
import {fountain_property_metadata} from "../../../config/fountain.properties"
import {PROP_STATUS_INFO, PROP_STATUS_OK} from "../../common/constants";

export function defaultCollectionEnhancement(fountainCollection,dbg, debugAll) {
  l.info('processing.service.js defaultCollectionEnhancement: '+dbg+' '+new Date().toISOString());
  return new Promise((resolve, reject)=>{
    fillImageGalleries(fountainCollection,dbg, debugAll)
      .then(r => fillOutNames(r,dbg))
      .then(r => fillWikipediaSummaries(r,dbg))
      .then(r => fillArtistNames(r,dbg))
      .then(r => fillOperatorInfo(r,dbg))
      .then(r => resolve(r))
      .catch(err=>reject(err))
  })
}


export function fillImageGalleries(fountainCollection, city, debugAll){
  // takes a collection of fountains and returns the same collection,
  // enhanced with image galleries when available or default images
	l.info('processing.service.js starting fillImageGalleries: '+city+' debugAll '+debugAll+' '+new Date().toISOString());  
  return new Promise((resolve, reject) => {
    let promises = [];
    let i = 0;
    let tot = fountainCollection.length;
    let step = 1;
    if (50 < tot) {
    	step = 10;
        if (300 < tot) {
        	step = 50;
            if (600 < tot) {
            	step = 100;
                if (1000 < tot) {
                	step = 200;
                    if (2000 < tot) {
                    	step = 500;
                    }
                }
            }
        }
    }
    let allMap = new Map();
    let dbgAll = debugAll;
    _.forEach(fountainCollection, fountain =>{
      i=i+1;
      if (!debugAll) {
    	  dbgAll = 0 ==i % step;
      }
      const dbg = i+'/'+tot;
      promises.push(WikimediaService.fillGallery(fountain, dbg, city, dbgAll, allMap));
    });
    
    Promise.all(promises)
      .then(r =>resolve(r))
      .catch(err=>reject(err));
    
  })
}

// created for proximap #129
export function fillArtistNames(fountainCollection,dbg){
  // takes a collection of fountains and returns the same collection,
  // enhanced with artist names if only QID was given
	l.info('processing.service.js starting fillArtistNames: '+dbg+' '+new Date().toISOString());
  return new Promise((resolve, reject) => {
    let promises = [];
    let i = 0;
    _.forEach(fountainCollection, fountain =>{
    	i++;
    	const idWd = fountain.properties.id_wikidata.value;
        let dbgHere = dbg + ' '+ idWd+ ' '+i+'/'+fountainCollection.length;	
        promises.push(WikidataService.fillArtistName(fountain,dbgHere));
    });
    
    Promise.all(promises)
      .then(r=>resolve(r))
      .catch(err=>reject(err));
    
  })
}

// created for proximap #149
export function fillOperatorInfo(fountainCollection, dbg){
  // takes a collection of fountains and returns the same collection,
  // enhanced with operator information if that information is available in Wikidata
  l.info('processing.service.js starting fillOperatorInfo: '+dbg+' '+new Date().toISOString());  
  return new Promise((resolve, reject) => {
    let promises = [];
    _.forEach(fountainCollection, fountain =>{
      promises.push(WikidataService.fillOperatorInfo(fountain,dbg));
    });
    
    Promise.all(promises)
      .then(r=>resolve(r))
      .catch(err=>reject(err));
    
  })
}

export function fillWikipediaSummaries(fountainCollection, dbg){
  // takes a collection of fountains and returns the same collection, enhanced with wikipedia summaries
	l.info('processing.service.js starting fillWikipediaSummaries: '+dbg+' '+new Date().toISOString());  
  return new Promise((resolve, reject) => {
    let promises = [];
    // loop through fountains
    _.forEach(fountainCollection, fountain =>{
      // check all languages to see if a wikipedia page is referenced
      let i = 0;
      let tot = fountainCollection.length;
      _.forEach(['en', 'de', 'fr', 'it', 'tr'], lang =>{
        let urlParam = `wikipedia_${lang}_url`;
        i=i+1;
        let dbgHere = i+'/'+tot+' '+dbg;
        if(!_.isNull(fountain.properties[urlParam].value)){
          // if not Null, get summary and create new property
          let dbgIdWd = null;
          if (null != fountain.properties.id_wikidata && null != fountain.properties.id_wikidata.value) {
            dbgIdWd = fountain.properties.id_wikidata.value;
          }       
          promises.push(new Promise((resolve, reject) => {
            WikipediaService.getSummary(fountain.properties[urlParam].value, dbgHere+' '+lang+' '+dbgIdWd)
              .then(summary => {
                // add summary as derived information to url property
                fountain.properties[urlParam].derived = {
                  summary: summary
                };
                resolve();
              })
              .catch(error=>{
                l.error(`Error creating Wikipedia summary: ${error}`);
                reject(error)
              })
          }));
        }
      });
    });
    
    Promise.all(promises)
      .then(r =>resolve(fountainCollection))
      .catch(err=>reject(err));
  })
}

export function createUniqueIds(fountainCollection){
  // takes a collection of fountains and returns the same collection, enhanced with unique and as persistent as possible ids
  return new Promise((resolve, reject) => {
    let i_n = 0;
    fountainCollection.forEach(f => {
      f.properties.id = i_n;
      f.properties.id_datablue = {
        value: i_n
      };
      i_n += 1;
    });
    resolve(fountainCollection)
  });
}

export function essenceOf(fountainCollection) {
  // returns a version of the fountain data with only the essential data
  let newCollection = {
    type: 'FeatureCollection',
    properties:
      {
        // Add last scan time info for https://github.com/water-fountains/proximap/issues/188
        last_scan: new Date()
      },
    features: []
  };
  
  // Get list of property names that are marked as essential in the metadata
  let essentialPropNames = _.map(fountain_property_metadata, (p, p_name)=>{if (p.essential) {return p_name} });
  let withGallery = 0;
  let strVw = 0;
  // Use the list of essential property names to create a compact version of the fountain data
  fountainCollection.features.forEach(f=>{
    let fPrps = f.properties;
    let props = _.pick(fPrps, essentialPropNames);
    props = _.mapValues(props, (obj)=>{
      return obj.value
    });
    // add id manually, since it does not have the standard property structure
    props.id = fPrps.id;
    // add photo if it is not google street view
    let fGal = fPrps.gallery;
    let fGV = fGal.value;
    let fGV0 = fGV[0];
    if (null == fGV0) {
      // l.info(fPrps.id+" null == fGV0 - essenceOf processing.service.js "+new Date().toISOString());
    } else {
      if (fGal.comments) {
        //leading to streetview default
        props.ph = '';
        strVw++;
      } else {
        props.ph = { s:fGV0.s,
                     pt:fGV0.pgTit };
        withGallery++;
      }
    }
    
    // create feature for fountain
    newCollection.features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: f.geometry.coordinates
      },
      properties: props
    })
  });
  l.info("processing.service.js essenceOf: withGallery "+withGallery+", strVw "+strVw+" "+new Date().toISOString());
  return newCollection;
  
}

export function fillOutNames(fountainCollection,dbg) {
  // takes a collection of fountains and returns the same collection, with blanks in fountain names filled from other languages or from 'name' property
	l.info('processing.service.js starting fillOutNames: '+dbg+' '+new Date().toISOString());  
  return new Promise((resolve, reject) => {
    let langs = ['en','de','fr', 'it', 'tr'];
    fountainCollection.forEach(f => {
      // if the default name (aka title) if not filled, then fill it from one of the other languages
      if(f.properties.name.value === null){
        for(let lang of langs){
          if(f.properties[`name_${lang}`].value !== null){
            // take the first language-specific name that is not null and apply it to the default name
            f.properties.name.value = f.properties[`name_${lang}`].value;
            f.properties.name.source_name = f.properties[`name_${lang}`].source_name;
            f.properties.name.source_url = f.properties[`name_${lang}`].source_url;
            f.properties.name.comments = `Value taken from language ${lang}.`;
            f.properties.name.status = PROP_STATUS_INFO;
            break;
          }
        }
      }
      // fill lang-specific names if null and if a default name exists
      if(f.properties.name.value !== null) {
        for (let lang of langs) {
          if (f.properties[`name_${lang}`].value === null) {
            f.properties[`name_${lang}`].value = f.properties.name.value;
            f.properties[`name_${lang}`].source_name = f.properties.name.source_name;
            f.properties[`name_${lang}`].source_url = f.properties.name.source_url;
            f.properties[`name_${lang}`].status = PROP_STATUS_INFO;
            if(f.properties.name.comments === ''){
              f.properties[`name_${lang}`].comments = 'Value taken from default language.';
            }else{
              f.properties[`name_${lang}`].comments = f.properties.name.comments;
            }
          }
        }
      }
      
    });
    resolve(fountainCollection)
  });
}

export function fillInMissingWikidataFountains(osm_fountains, wikidata_fountains, dbg){
  // Created for #212. This function should run before conflation. It checks if all Wikidata
  // fountains referenced in OSM have been fetched, and fetches any missing wikidata fountains.
  // It returns the original OSM fountain collection and the completed Wikidata fountain collection.
  
  return new Promise((resolve, reject)=>{
    // Get list of all Wikidata fountain qids referenced by OSM
    let qid_from_osm = _.compact(_.map(osm_fountains, f=>_.get(f,['properties', 'wikidata'])));
  
    // Get list of all Wikidata fountain qids collected
    let qid_from_wikidata = _.map(wikidata_fountains, 'id');
  
    // Get qids not included in wikidata collection
    let missing_qids = _.difference(qid_from_osm, qid_from_wikidata);
    if (null == missing_qids) {
        l.info('processing.service.js fillInMissingWikidataFountains: none for '+dbg+' '+new Date().toISOString());
    } else {
        l.info('processing.service.js fillInMissingWikidataFountains: '+missing_qids.length+' for '+dbg+' '+missing_qids+' '+new Date().toISOString());
    }

    // Fetch fountains with missing qids and add them to the wikidata_fountains collection
    WikidataService.byIds(missing_qids, dbg)
      .then(missing_wikidata_fountains=>{
        resolve({
          osm: osm_fountains,
          wikidata: missing_wikidata_fountains.concat(wikidata_fountains)
        })
      })
  });
  
}