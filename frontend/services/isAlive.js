import { apiCall } from "./baseApi";

export const isAliveCheck ={
 //API CALL FOR BACKEND ALIVE CHECK
 connectBackend: async()=>{
    return apiCall('/connect',{
        method:"GET"
    })
 },
};