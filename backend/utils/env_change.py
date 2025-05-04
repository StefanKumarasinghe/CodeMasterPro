
from dotenv import set_key, dotenv_values
from fastapi import  HTTPException
from Model.ApiKeyData import ApiKeyData
from Model.ApiKeyRequest import ApiKeyRequest
import config.tars as gemini

ENV_FILE_PATH = gemini.ENV_FILE_PATH

async def get_api_key(data: ApiKeyRequest):
    try:
        config = dotenv_values(ENV_FILE_PATH)
        service_id = data.serviceId.strip().lower()
        key_name = {
            "brave": "BRAVE_API_KEY",
            "together-ai": "TOGETHER_AI_API_KEY",
            "gemini": "GOOGLE_API_KEY"
        }.get(service_id, f"{service_id.upper().replace('-', '_').replace(' ', '_')}_API_KEY")

        api_key = config.get(key_name)
        if api_key is None:
            raise HTTPException(status_code=404, detail="API key not found. Please set it first.")

        if service_id == "gemini":
            return {"apiKey": "Access to this key is restricted. This is because you only can change it via the .env file. Please update it manually if needed."}

        return {"apiKey": api_key}

    except IOError as e:
        gemini.logger.error(f"Failed to read API key: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to read API key: {str(e)}")

async def save_api_key(data: ApiKeyData):
    try:
        service_id = data.serviceId.strip().lower()


        if service_id == "gemini":
            raise HTTPException(
                status_code=403,
                detail="You cannot change the Gemini API token via this interface. Please update it manually if needed."
            )

    
        key_name = {
            "brave": "BRAVE_API_KEY",
            "together": "TOGETHER_API_KEY"
        }.get(service_id, f"{service_id.upper().replace('-', '_').replace(' ', '_')}_API_KEY")

        set_key(str(ENV_FILE_PATH), key_name, data.apiKey)

        return {
            "detail": f"Please restart the application or container for the changes to take effect",
            "key": key_name
        }

    except IOError as e:
        gemini.logger.error(f"Failed to save/update API key: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save/update API key: {str(e)}")
    except HTTPException:
        raise 
    except Exception as e:
        gemini.logger.error(f"An unexpected error occurred: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")
    