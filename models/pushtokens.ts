export interface PushTokens {
    id?: string;    
    application_id: string;
    user_id: string;
    token: string;
	is_active: boolean;
    push_provider_code: string;
    created_time: Date;
    updated_time: Date;    
};

export default PushTokens;


