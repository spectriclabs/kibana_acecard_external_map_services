import { AcecardEMSConfig } from '../common/config';


let config: AcecardEMSConfig;
export const setConfig = (settings:AcecardEMSConfig) =>{
    config = settings
  }
export const getConfig = () => config