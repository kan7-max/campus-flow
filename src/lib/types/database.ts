export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      courses: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          day_of_week: string;
          start_time: string;
          end_time: string;
          room: string | null;
          instructor: string | null;
          color: string;
          memo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          day_of_week: string;
          start_time: string;
          end_time: string;
          room?: string | null;
          instructor?: string | null;
          color?: string;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          day_of_week?: string;
          start_time?: string;
          end_time?: string;
          room?: string | null;
          instructor?: string | null;
          color?: string;
          memo?: string | null;
          updated_at?: string;
        };
      };
      assignments: {
        Row: {
          id: string;
          user_id: string;
          course_id: string | null;
          title: string;
          due_at: string;
          submission_target: string | null;
          assignment_type: string;
          memo: string | null;
          priority_label: string;
          priority_score: number;
          progress: number;
          status: string;
          url: string | null;
          estimated_hours: number;
          ai_source_text: string | null;
          ai_confidence: number | null;
          is_heavy: boolean;
          tags: string[];
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id?: string | null;
          title: string;
          due_at: string;
          submission_target?: string | null;
          assignment_type: string;
          memo?: string | null;
          priority_label?: string;
          priority_score?: number;
          progress?: number;
          status?: string;
          url?: string | null;
          estimated_hours?: number;
          ai_source_text?: string | null;
          ai_confidence?: number | null;
          is_heavy?: boolean;
          tags?: string[];
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          course_id?: string | null;
          title?: string;
          due_at?: string;
          submission_target?: string | null;
          assignment_type?: string;
          memo?: string | null;
          priority_label?: string;
          priority_score?: number;
          progress?: number;
          status?: string;
          url?: string | null;
          estimated_hours?: number;
          ai_source_text?: string | null;
          ai_confidence?: number | null;
          is_heavy?: boolean;
          tags?: string[];
          deleted_at?: string | null;
          updated_at?: string;
        };
      };
      subtasks: {
        Row: {
          id: string;
          assignment_id: string;
          title: string;
          done: boolean;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          title: string;
          done?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          done?: boolean;
          order_index?: number;
          updated_at?: string;
        };
      };
      assignment_steps: {
        Row: {
          id: string;
          user_id: string;
          assignment_id: string;
          title: string;
          description: string | null;
          status: string;
          estimated_minutes: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          assignment_id: string;
          title: string;
          description?: string | null;
          status?: string;
          estimated_minutes?: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: string;
          estimated_minutes?: number;
          sort_order?: number;
          updated_at?: string;
        };
      };
      attachments: {
        Row: {
          id: string;
          assignment_id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          mime_type: string | null;
          file_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
        Update: {
          file_name?: string;
          file_path?: string;
          mime_type?: string | null;
          file_size?: number | null;
        };
      };
      calendar_sync_records: {
        Row: {
          id: string;
          assignment_id: string;
          user_id: string;
          provider: string;
          external_event_id: string | null;
          sync_status: string;
          error_message: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          user_id: string;
          provider?: string;
          external_event_id?: string | null;
          sync_status?: string;
          error_message?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          external_event_id?: string | null;
          sync_status?: string;
          error_message?: string | null;
          last_synced_at?: string | null;
          updated_at?: string;
        };
      };
      sync_outbox: {
        Row: {
          id: string;
          user_id: string;
          assignment_id: string | null;
          provider: string;
          operation: string;
          status: string;
          attempts: number;
          payload: Json;
          last_error: string | null;
          available_at: string;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          assignment_id?: string | null;
          provider?: string;
          operation: string;
          status?: string;
          attempts?: number;
          payload?: Json;
          last_error?: string | null;
          available_at?: string;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string | null;
          provider?: string;
          operation?: string;
          status?: string;
          attempts?: number;
          payload?: Json;
          last_error?: string | null;
          available_at?: string;
          processed_at?: string | null;
          updated_at?: string;
        };
      };
      study_blocks: {
        Row: {
          id: string;
          user_id: string;
          assignment_id: string | null;
          course_id: string | null;
          title: string;
          description: string | null;
          planned_date: string;
          start_time: string | null;
          end_time: string | null;
          duration_minutes: number;
          status: string;
          source: string;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          assignment_id?: string | null;
          course_id?: string | null;
          title: string;
          description?: string | null;
          planned_date: string;
          start_time?: string | null;
          end_time?: string | null;
          duration_minutes?: number;
          status?: string;
          source?: string;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string | null;
          course_id?: string | null;
          title?: string;
          description?: string | null;
          planned_date?: string;
          start_time?: string | null;
          end_time?: string | null;
          duration_minutes?: number;
          status?: string;
          source?: string;
          priority?: number;
          updated_at?: string;
        };
      };
      work_sessions: {
        Row: {
          id: string;
          user_id: string;
          assignment_id: string;
          started_at: string;
          ended_at: string | null;
          planned_minutes: number;
          progress_before: number;
          progress_after: number | null;
          note: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          assignment_id: string;
          started_at?: string;
          ended_at?: string | null;
          planned_minutes?: number;
          progress_before?: number;
          progress_after?: number | null;
          note?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          ended_at?: string | null;
          planned_minutes?: number;
          progress_before?: number;
          progress_after?: number | null;
          note?: string | null;
          status?: string;
          updated_at?: string;
        };
      };
      inbox_items: {
        Row: {
          id: string;
          user_id: string;
          raw_text: string;
          source_type: string;
          status: string;
          parsed_payload: Json | null;
          created_assignment_id: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          raw_text: string;
          source_type?: string;
          status?: string;
          parsed_payload?: Json | null;
          created_assignment_id?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          raw_text?: string;
          source_type?: string;
          status?: string;
          parsed_payload?: Json | null;
          created_assignment_id?: string | null;
          error_message?: string | null;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          assignment_id: string;
          channel: string;
          notify_at: string;
          delivered_at: string | null;
          status: string;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          assignment_id: string;
          channel: string;
          notify_at: string;
          delivered_at?: string | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          delivered_at?: string | null;
          status?: string;
          error_message?: string | null;
          updated_at?: string;
        };
      };
      ai_extraction_logs: {
        Row: {
          id: string;
          user_id: string;
          source_type: string;
          source_text: string;
          extracted_json: Json;
          confidence_avg: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type: string;
          source_text: string;
          extracted_json: Json;
          confidence_avg?: number | null;
          created_at?: string;
        };
        Update: {
          source_type?: string;
          source_text?: string;
          extracted_json?: Json;
          confidence_avg?: number | null;
        };
      };
      ai_usage_logs: {
        Row: {
          id: string;
          user_id: string;
          feature: string;
          model: string;
          input_tokens: number | null;
          output_tokens: number | null;
          credits_used: number;
          status: string;
          error_message: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          feature: string;
          model: string;
          input_tokens?: number | null;
          output_tokens?: number | null;
          credits_used?: number;
          status: string;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          feature?: string;
          model?: string;
          input_tokens?: number | null;
          output_tokens?: number | null;
          credits_used?: number;
          status?: string;
          error_message?: string | null;
          metadata?: Json;
        };
      };
      ai_credit_balances: {
        Row: {
          id: string;
          user_id: string;
          month_key: string;
          plan: string;
          monthly_limit: number;
          credits_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_key: string;
          plan?: string;
          monthly_limit?: number;
          credits_used?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan?: string;
          monthly_limit?: number;
          credits_used?: number;
          updated_at?: string;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          display_name: string | null;
          onboarding_completed: boolean;
          timezone: string;
          theme: string;
          preferred_available_minutes: number;
          preferred_today_mode: string;
          ai_enabled: boolean;
          google_calendar_enabled: boolean;
          setup_course_names: string[];
          priority_weights: Json;
          notification_config: Json;
          google_access_token: string | null;
          google_refresh_token: string | null;
          google_token_expiry: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string | null;
          onboarding_completed?: boolean;
          timezone?: string;
          theme?: string;
          preferred_available_minutes?: number;
          preferred_today_mode?: string;
          ai_enabled?: boolean;
          google_calendar_enabled?: boolean;
          setup_course_names?: string[];
          priority_weights?: Json;
          notification_config?: Json;
          google_access_token?: string | null;
          google_refresh_token?: string | null;
          google_token_expiry?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          onboarding_completed?: boolean;
          timezone?: string;
          theme?: string;
          preferred_available_minutes?: number;
          preferred_today_mode?: string;
          ai_enabled?: boolean;
          google_calendar_enabled?: boolean;
          setup_course_names?: string[];
          priority_weights?: Json;
          notification_config?: Json;
          google_access_token?: string | null;
          google_refresh_token?: string | null;
          google_token_expiry?: string | null;
          updated_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          subscription: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subscription?: Json;
          updated_at?: string;
        };
      };
    };
  };
};
