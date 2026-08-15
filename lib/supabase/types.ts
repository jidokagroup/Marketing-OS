/**
 * Hand-written Database type matching supabase/migrations/*.
 *
 * Once the live project exists, this can be regenerated with:
 *   supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
 * (or the Supabase MCP `generate_typescript_types`). Until then this keeps
 * the app fully type-checked against the schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AgentStatus = "draft" | "analyzing" | "ready" | "error";
export type AssetStatus = "pending" | "extracted" | "error";
/** Lifecycle of a competitor scan report (see migration 0022). */
export type ScanStatus = "queued" | "running" | "complete" | "failed";

type Timestamps = { created_at: string };
type Mutable = Timestamps & { updated_at: string };

// Helper for jsonb-backed structured columns kept loose at the DB layer;
// concrete shapes live in lib/schemas/* and are applied where consumed.
type JsonObject = Record<string, Json>;
type JsonArray = Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Mutable & { id: string; email: string | null; full_name: string | null };
        Insert: { id: string; email?: string | null; full_name?: string | null };
        Update: { email?: string | null; full_name?: string | null };
        Relationships: [];
      };
      clients: {
        Row: Mutable & {
          id: string;
          owner_id: string;
          name: string;
          industry: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          industry?: string | null;
          notes?: string | null;
        };
        Update: { name?: string; industry?: string | null; notes?: string | null };
        Relationships: [];
      };
      writing_agents: {
        Row: Mutable & {
          id: string;
          owner_id: string;
          client_id: string | null;
          name: string;
          industry: string | null;
          platform: string | null;
          notes: string | null;
          status: AgentStatus;
          last_analyzed_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          client_id?: string | null;
          name: string;
          industry?: string | null;
          platform?: string | null;
          notes?: string | null;
          status?: AgentStatus;
          last_analyzed_at?: string | null;
        };
        Update: {
          client_id?: string | null;
          name?: string;
          industry?: string | null;
          platform?: string | null;
          notes?: string | null;
          status?: AgentStatus;
          last_analyzed_at?: string | null;
        };
        Relationships: [];
      };
      uploaded_assets: {
        Row: Timestamps & {
          id: string;
          agent_id: string;
          owner_id: string;
          kind: string;
          title: string | null;
          source_url: string | null;
          storage_path: string | null;
          mime_type: string | null;
          byte_size: number | null;
          extracted_text: string | null;
          char_count: number | null;
          status: AssetStatus;
          error: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          owner_id: string;
          kind?: string;
          title?: string | null;
          source_url?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          extracted_text?: string | null;
          char_count?: number | null;
          status?: AssetStatus;
          error?: string | null;
        };
        Update: {
          title?: string | null;
          extracted_text?: string | null;
          char_count?: number | null;
          status?: AssetStatus;
          error?: string | null;
        };
        Relationships: [];
      };
      uploaded_scripts: {
        Row: Timestamps & {
          id: string;
          agent_id: string;
          owner_id: string;
          asset_id: string | null;
          chunk_index: number;
          content: string;
          token_count: number | null;
          embedding: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          owner_id: string;
          asset_id?: string | null;
          chunk_index?: number;
          content: string;
          token_count?: number | null;
          embedding?: string | null;
        };
        Update: { embedding?: string | null };
        Relationships: [];
      };
      voice_profiles: {
        Row: Mutable & {
          id: string;
          agent_id: string;
          owner_id: string;
          tone: JsonObject;
          syntax: JsonObject;
          formatting: JsonObject;
          emotional_profile: JsonObject;
          quirks: JsonObject;
          fingerprint: JsonObject;
          summary: string | null;
        };
        Insert: ProfileInsert<{
          tone?: Json;
          syntax?: Json;
          formatting?: Json;
          emotional_profile?: Json;
          quirks?: Json;
          fingerprint?: Json;
          summary?: string | null;
        }>;
        Update: Partial<ProfileInsert<Record<string, Json>>>;
        Relationships: [];
      };
      belief_profiles: {
        Row: Mutable & {
          id: string;
          agent_id: string;
          owner_id: string;
          core_beliefs: JsonArray;
          contrarian_beliefs: JsonArray;
          industry_opinions: JsonArray;
          philosophies: JsonArray;
          decision_frameworks: JsonArray;
          summary: string | null;
        };
        Insert: ProfileInsert<Record<string, Json | null>>;
        Update: Partial<ProfileInsert<Record<string, Json>>>;
        Relationships: [];
      };
      hook_libraries: {
        Row: Mutable & { id: string; agent_id: string; owner_id: string; hooks: JsonArray };
        Insert: ProfileInsert<{ hooks?: Json }>;
        Update: Partial<ProfileInsert<{ hooks?: Json }>>;
        Relationships: [];
      };
      story_frameworks: {
        Row: Mutable & {
          id: string;
          agent_id: string;
          owner_id: string;
          frameworks: JsonArray;
          emotional_arcs: JsonArray;
        };
        Insert: ProfileInsert<{ frameworks?: Json; emotional_arcs?: Json }>;
        Update: Partial<ProfileInsert<{ frameworks?: Json; emotional_arcs?: Json }>>;
        Relationships: [];
      };
      phrase_libraries: {
        Row: Mutable & {
          id: string;
          agent_id: string;
          owner_id: string;
          favorite_words: JsonArray;
          favorite_phrases: JsonArray;
          openers: JsonArray;
          closers: JsonArray;
          transitions: JsonArray;
          metaphors: JsonArray;
          ctas: JsonArray;
          analogies: JsonArray;
        };
        Insert: ProfileInsert<Record<string, Json>>;
        Update: Partial<ProfileInsert<Record<string, Json>>>;
        Relationships: [];
      };
      knowledge_graphs: {
        Row: Mutable & {
          id: string;
          agent_id: string;
          owner_id: string;
          company: JsonObject;
          products: JsonArray;
          customers: JsonArray;
          competitors: JsonArray;
          objections: JsonArray;
          testimonials: JsonArray;
          brand_assets: JsonArray;
          summary: string | null;
        };
        Insert: ProfileInsert<Record<string, Json | null>>;
        Update: Partial<ProfileInsert<Record<string, Json>>>;
        Relationships: [];
      };
      generated_content: {
        Row: Timestamps & {
          id: string;
          agent_id: string;
          owner_id: string;
          title: string | null;
          topic: string | null;
          goal: string | null;
          platform: string | null;
          audience: string | null;
          offer: string | null;
          cta: string | null;
          length: string | null;
          notes: string | null;
          primary_script: string | null;
          alternate_hooks: JsonArray;
          alternate_ctas: JsonArray;
          short_version: string | null;
          long_version: string | null;
          organic_version: string | null;
          sales_version: string | null;
          blog_cta: string | null;
          email_cta: string | null;
          blog_keywords: JsonArray;
          blog_link_suggestions: JsonArray;
          retrieved_script_ids: string[];
          overall_score: number | null;
          below_threshold: boolean;
          attempts: number;
          model: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          owner_id: string;
          title?: string | null;
          topic?: string | null;
          goal?: string | null;
          platform?: string | null;
          audience?: string | null;
          offer?: string | null;
          cta?: string | null;
          length?: string | null;
          notes?: string | null;
          primary_script?: string | null;
          alternate_hooks?: Json;
          alternate_ctas?: Json;
          short_version?: string | null;
          long_version?: string | null;
          organic_version?: string | null;
          sales_version?: string | null;
          blog_cta?: string | null;
          email_cta?: string | null;
          blog_keywords?: Json;
          blog_link_suggestions?: Json;
          retrieved_script_ids?: string[];
          overall_score?: number | null;
          below_threshold?: boolean;
          attempts?: number;
          model?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["generated_content"]["Insert"]>;
        Relationships: [];
      };
      quality_scores: {
        Row: Timestamps & {
          id: string;
          generated_content_id: string;
          owner_id: string;
          voice_match: number | null;
          syntax_match: number | null;
          hook_match: number | null;
          story_match: number | null;
          belief_match: number | null;
          emotional_match: number | null;
          phrase_match: number | null;
          brand_accuracy: number | null;
          knowledge_accuracy: number | null;
          overall: number | null;
          attempt: number;
          rationale: string | null;
        };
        Insert: {
          id?: string;
          generated_content_id: string;
          owner_id: string;
          voice_match?: number | null;
          syntax_match?: number | null;
          hook_match?: number | null;
          story_match?: number | null;
          belief_match?: number | null;
          emotional_match?: number | null;
          phrase_match?: number | null;
          brand_accuracy?: number | null;
          knowledge_accuracy?: number | null;
          overall?: number | null;
          attempt?: number;
          rationale?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["quality_scores"]["Insert"]>;
        Relationships: [];
      };
      revision_logs: {
        Row: Timestamps & {
          id: string;
          generated_content_id: string;
          owner_id: string;
          original_text: string | null;
          edited_text: string | null;
          published_text: string | null;
          diff: Json | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          generated_content_id: string;
          owner_id: string;
          original_text?: string | null;
          edited_text?: string | null;
          published_text?: string | null;
          diff?: Json | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["revision_logs"]["Insert"]>;
        Relationships: [];
      };
      performance_metrics: {
        Row: Timestamps & {
          id: string;
          agent_id: string;
          owner_id: string;
          platform: string | null;
          external_id: string | null;
          content_excerpt: string | null;
          metrics: JsonObject;
          tier: string | null;
          captured_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          owner_id: string;
          platform?: string | null;
          external_id?: string | null;
          content_excerpt?: string | null;
          metrics?: Json;
          tier?: string | null;
          captured_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["performance_metrics"]["Insert"]>;
        Relationships: [];
      };
      training_assets: {
        Row: Timestamps & {
          id: string;
          agent_id: string;
          owner_id: string;
          kind: string | null;
          payload: JsonObject;
        };
        Insert: {
          id?: string;
          agent_id: string;
          owner_id: string;
          kind?: string | null;
          payload?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["training_assets"]["Insert"]>;
        Relationships: [];
      };
      brand_brains: {
        Row: Mutable & {
          id: string;
          agent_id: string;
          owner_id: string;
          business_name: string | null;
          industry: string | null;
          description: string | null;
          language: string | null;
          tone: string[];
          tone_notes: string | null;
          offers: string | null;
          services_products: string | null;
          pricing: string | null;
          brand_voice_examples: string | null;
          web_link: string | null;
          booking_link: string | null;
          allowed_ctas: string | null;
          cta_keywords: string[];
          cta_links: Json;
          faqs: Json;
          emoji_allowed: boolean;
          formality_level: number;
          location: string | null;
          hours: string | null;
          phone: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          owner_id: string;
          business_name?: string | null;
          industry?: string | null;
          description?: string | null;
          language?: string | null;
          tone?: string[];
          tone_notes?: string | null;
          offers?: string | null;
          services_products?: string | null;
          pricing?: string | null;
          brand_voice_examples?: string | null;
          web_link?: string | null;
          booking_link?: string | null;
          allowed_ctas?: string | null;
          cta_keywords?: string[];
          cta_links?: Json;
          faqs?: Json;
          emoji_allowed?: boolean;
          formality_level?: number;
          location?: string | null;
          hours?: string | null;
          phone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["brand_brains"]["Insert"]>;
        Relationships: [];
      };
      social_accounts: {
        Row: Mutable & {
          id: string;
          agent_id: string;
          owner_id: string;
          platform: string;
          external_account_id: string | null;
          username: string | null;
          profile_picture_url: string | null;
          access_token_encrypted: string | null;
          page_id: string | null;
          page_token_encrypted: string | null;
          token_expires_at: string | null;
          status: string;
          connected_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          owner_id: string;
          platform: string;
          external_account_id?: string | null;
          username?: string | null;
          profile_picture_url?: string | null;
          access_token_encrypted?: string | null;
          page_id?: string | null;
          page_token_encrypted?: string | null;
          token_expires_at?: string | null;
          status?: string;
          connected_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["social_accounts"]["Insert"]>;
        Relationships: [];
      };
      scheduled_posts: {
        Row: Mutable & {
          id: string;
          agent_id: string;
          owner_id: string;
          generated_content_id: string | null;
          social_account_id: string | null;
          platform: string;
          title: string | null;
          caption: string | null;
          script: string | null;
          media_url: string | null;
          media_path: string | null;
          content_type: string;
          status: string;
          scheduled_time: string | null;
          best_posting_window: string | null;
          ideal_days: string | null;
          confidence_score: number | null;
          schedule_reason: string | null;
          comment_dm_enabled: boolean;
          comment_auto_reply: string | null;
          dm_sequence: string | null;
          source_import: string | null;
          media_file_name: string | null;
          posted_at: string | null;
          external_post_id: string | null;
          performance_score: number | null;
          error: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          owner_id: string;
          generated_content_id?: string | null;
          social_account_id?: string | null;
          platform?: string;
          title?: string | null;
          caption?: string | null;
          script?: string | null;
          media_url?: string | null;
          media_path?: string | null;
          content_type?: string;
          status?: string;
          scheduled_time?: string | null;
          best_posting_window?: string | null;
          ideal_days?: string | null;
          confidence_score?: number | null;
          schedule_reason?: string | null;
          comment_dm_enabled?: boolean;
          comment_auto_reply?: string | null;
          dm_sequence?: string | null;
          source_import?: string | null;
          media_file_name?: string | null;
          posted_at?: string | null;
          external_post_id?: string | null;
          performance_score?: number | null;
          error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["scheduled_posts"]["Insert"]>;
        Relationships: [];
      };
      inbox_threads: {
        Row: Mutable & {
          id: string;
          owner_id: string;
          client_id: string | null;
          agent_id: string | null;
          social_account_id: string | null;
          scheduled_post_id: string | null;
          platform: string;
          channel: string;
          external_thread_id: string | null;
          participant_id: string | null;
          participant_username: string | null;
          status: string;
          review_reason: string | null;
          last_message_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          client_id?: string | null;
          agent_id?: string | null;
          social_account_id?: string | null;
          scheduled_post_id?: string | null;
          platform?: string;
          channel?: string;
          external_thread_id?: string | null;
          participant_id?: string | null;
          participant_username?: string | null;
          status?: string;
          review_reason?: string | null;
          last_message_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["inbox_threads"]["Insert"]>;
        Relationships: [];
      };
      inbox_messages: {
        Row: Timestamps & {
          id: string;
          thread_id: string;
          owner_id: string;
          role: string;
          message_type: string;
          body: string;
          ai_generated: boolean;
          status: string;
          external_message_id: string | null;
        };
        Insert: {
          id?: string;
          thread_id: string;
          owner_id: string;
          role?: string;
          message_type?: string;
          body: string;
          ai_generated?: boolean;
          status?: string;
          external_message_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inbox_messages"]["Insert"]>;
        Relationships: [];
      };
      inbox_reviews: {
        Row: Timestamps & {
          id: string;
          thread_id: string;
          owner_id: string;
          reviewer_id: string | null;
          action: string;
          edited_body: string | null;
          note: string | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          thread_id: string;
          owner_id: string;
          reviewer_id?: string | null;
          action: string;
          edited_body?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inbox_reviews"]["Insert"]>;
        Relationships: [];
      };
      platform_analytics: {
        Row: Timestamps & {
          id: string;
          agent_id: string;
          owner_id: string;
          social_account_id: string | null;
          scheduled_post_id: string | null;
          platform: string;
          post_id: string | null;
          title: string | null;
          posted_time: string | null;
          fetched_at: string;
          date: string | null;
          hour: number | null;
          day_of_week: string | null;
          caption: string | null;
          media_type: string | null;
          views: number;
          impressions: number;
          reach: number;
          likes: number;
          comments: number;
          shares: number;
          saves: number;
          reposts: number;
          watch_time: number;
          followers_gained: number;
          engagement_score: number;
          performance_score: number;
          raw_metrics: Json | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          owner_id: string;
          social_account_id?: string | null;
          scheduled_post_id?: string | null;
          platform?: string;
          post_id?: string | null;
          title?: string | null;
          posted_time?: string | null;
          fetched_at?: string;
          date?: string | null;
          hour?: number | null;
          day_of_week?: string | null;
          caption?: string | null;
          media_type?: string | null;
          views?: number;
          impressions?: number;
          reach?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          saves?: number;
          reposts?: number;
          watch_time?: number;
          followers_gained?: number;
          engagement_score?: number;
          performance_score?: number;
          raw_metrics?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["platform_analytics"]["Insert"]>;
        Relationships: [];
      };
      social_intelligence_reports: {
        Row: Timestamps & {
          id: string;
          owner_id: string;
          agent_id: string | null;
          industry: string;
          platforms: string[];
          competitor_accounts: string[];
          trending_topics: Json;
          hooks: Json;
          audios: Json;
          content_opportunities: Json;
          summary: string | null;
          scanned_at: string;
          status: ScanStatus;
          error_message: string | null;
          requested_at: string;
          client_id: string | null;
          recommendations: Json;
        };
        Insert: {
          id?: string;
          owner_id: string;
          agent_id?: string | null;
          industry?: string;
          platforms?: string[];
          competitor_accounts?: string[];
          trending_topics?: Json;
          hooks?: Json;
          audios?: Json;
          content_opportunities?: Json;
          summary?: string | null;
          scanned_at?: string;
          status?: ScanStatus;
          error_message?: string | null;
          requested_at?: string;
          client_id?: string | null;
          recommendations?: Json;
        };
        Update: Partial<
          Database["public"]["Tables"]["social_intelligence_reports"]["Insert"]
        >;
        Relationships: [];
      };
      film_sessions: {
        Row: {
          id: string;
          owner_id: string;
          agent_id: string;
          client_id: string | null;
          title: string;
          client_name: string | null;
          source_material: string | null;
          format_mix: Json;
          scripts: Json;
          script_count: number;
          status: string;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          agent_id: string;
          client_id?: string | null;
          title: string;
          client_name?: string | null;
          source_material?: string | null;
          format_mix?: Json;
          scripts?: Json;
          script_count?: number;
          status?: string;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["film_sessions"]["Insert"]>;
        Relationships: [];
      };
      brkfree_profiles: Database["public"]["Tables"]["profiles"];
      brkfree_clients: Database["public"]["Tables"]["clients"];
      brkfree_writing_agents: Database["public"]["Tables"]["writing_agents"];
      brkfree_uploaded_assets: Database["public"]["Tables"]["uploaded_assets"];
      brkfree_uploaded_scripts: Database["public"]["Tables"]["uploaded_scripts"];
      brkfree_voice_profiles: Database["public"]["Tables"]["voice_profiles"];
      brkfree_belief_profiles: Database["public"]["Tables"]["belief_profiles"];
      brkfree_hook_libraries: Database["public"]["Tables"]["hook_libraries"];
      brkfree_story_frameworks: Database["public"]["Tables"]["story_frameworks"];
      brkfree_phrase_libraries: Database["public"]["Tables"]["phrase_libraries"];
      brkfree_knowledge_graphs: Database["public"]["Tables"]["knowledge_graphs"];
      brkfree_generated_content: Database["public"]["Tables"]["generated_content"];
      brkfree_quality_scores: Database["public"]["Tables"]["quality_scores"];
      brkfree_revision_logs: Database["public"]["Tables"]["revision_logs"];
      brkfree_performance_metrics: Database["public"]["Tables"]["performance_metrics"];
      brkfree_training_assets: Database["public"]["Tables"]["training_assets"];
      brkfree_brand_brains: Database["public"]["Tables"]["brand_brains"];
      brkfree_social_accounts: Database["public"]["Tables"]["social_accounts"];
      brkfree_scheduled_posts: Database["public"]["Tables"]["scheduled_posts"];
      brkfree_inbox_threads: Database["public"]["Tables"]["inbox_threads"];
      brkfree_inbox_messages: Database["public"]["Tables"]["inbox_messages"];
      brkfree_inbox_reviews: Database["public"]["Tables"]["inbox_reviews"];
      brkfree_platform_analytics: Database["public"]["Tables"]["platform_analytics"];
      brkfree_social_intelligence_reports: Database["public"]["Tables"]["social_intelligence_reports"];
      brkfree_film_sessions: Database["public"]["Tables"]["film_sessions"];
      marketing_os_profiles: Database["public"]["Tables"]["profiles"];
      marketing_os_clients: Database["public"]["Tables"]["clients"];
      marketing_os_writing_agents: Database["public"]["Tables"]["writing_agents"];
      marketing_os_uploaded_assets: Database["public"]["Tables"]["uploaded_assets"];
      marketing_os_uploaded_scripts: Database["public"]["Tables"]["uploaded_scripts"];
      marketing_os_voice_profiles: Database["public"]["Tables"]["voice_profiles"];
      marketing_os_belief_profiles: Database["public"]["Tables"]["belief_profiles"];
      marketing_os_hook_libraries: Database["public"]["Tables"]["hook_libraries"];
      marketing_os_story_frameworks: Database["public"]["Tables"]["story_frameworks"];
      marketing_os_phrase_libraries: Database["public"]["Tables"]["phrase_libraries"];
      marketing_os_knowledge_graphs: Database["public"]["Tables"]["knowledge_graphs"];
      marketing_os_generated_content: Database["public"]["Tables"]["generated_content"];
      marketing_os_quality_scores: Database["public"]["Tables"]["quality_scores"];
      marketing_os_revision_logs: Database["public"]["Tables"]["revision_logs"];
      marketing_os_performance_metrics: Database["public"]["Tables"]["performance_metrics"];
      marketing_os_training_assets: Database["public"]["Tables"]["training_assets"];
      marketing_os_brand_brains: Database["public"]["Tables"]["brand_brains"];
      marketing_os_social_accounts: Database["public"]["Tables"]["social_accounts"];
      marketing_os_scheduled_posts: Database["public"]["Tables"]["scheduled_posts"];
      marketing_os_inbox_threads: Database["public"]["Tables"]["inbox_threads"];
      marketing_os_inbox_messages: Database["public"]["Tables"]["inbox_messages"];
      marketing_os_inbox_reviews: Database["public"]["Tables"]["inbox_reviews"];
      marketing_os_platform_analytics: Database["public"]["Tables"]["platform_analytics"];
      marketing_os_social_intelligence_reports: Database["public"]["Tables"]["social_intelligence_reports"];
      marketing_os_film_sessions: Database["public"]["Tables"]["film_sessions"];
    };
    Views: Record<never, never>;
    Functions: {
      match_scripts: {
        Args: {
          p_agent_id: string;
          p_query_embedding: string;
          p_match_count?: number;
        };
        Returns: {
          id: string;
          asset_id: string | null;
          chunk_index: number;
          content: string;
          similarity: number;
        }[];
      };
      brkfree_match_scripts: Database["public"]["Functions"]["match_scripts"];
      marketing_os_match_scripts: Database["public"]["Functions"]["match_scripts"];
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

// Common columns every profile-style Insert carries.
type ProfileInsert<T> = T & {
  id?: string;
  agent_id: string;
  owner_id: string;
};

// Convenience row aliases used across the app.
type Tables = Database["public"]["Tables"];
export type Profile = Tables["marketing_os_profiles"]["Row"];
export type Client = Tables["marketing_os_clients"]["Row"];
export type WritingAgent = Tables["marketing_os_writing_agents"]["Row"];
export type UploadedAsset = Tables["marketing_os_uploaded_assets"]["Row"];
export type UploadedScript = Tables["marketing_os_uploaded_scripts"]["Row"];
export type VoiceProfile = Tables["marketing_os_voice_profiles"]["Row"];
export type BeliefProfile = Tables["marketing_os_belief_profiles"]["Row"];
export type HookLibrary = Tables["marketing_os_hook_libraries"]["Row"];
export type StoryFramework = Tables["marketing_os_story_frameworks"]["Row"];
export type PhraseLibrary = Tables["marketing_os_phrase_libraries"]["Row"];
export type KnowledgeGraph = Tables["marketing_os_knowledge_graphs"]["Row"];
export type GeneratedContent = Tables["marketing_os_generated_content"]["Row"];
export type QualityScore = Tables["marketing_os_quality_scores"]["Row"];
export type RevisionLog = Tables["marketing_os_revision_logs"]["Row"];
export type BrandBrain = Tables["marketing_os_brand_brains"]["Row"];
export type SocialAccount = Tables["marketing_os_social_accounts"]["Row"];
export type ScheduledPost = Tables["marketing_os_scheduled_posts"]["Row"];
export type InboxThread = Tables["marketing_os_inbox_threads"]["Row"];
export type InboxMessage = Tables["marketing_os_inbox_messages"]["Row"];
export type InboxReview = Tables["marketing_os_inbox_reviews"]["Row"];
export type PlatformAnalytics = Tables["marketing_os_platform_analytics"]["Row"];
export type SocialIntelligenceReport =
  Tables["marketing_os_social_intelligence_reports"]["Row"];

export type PostStatus = "draft" | "scheduled" | "posting" | "posted" | "failed";
export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "youtube"
  | "tiktok"
  | "x"
  | "linkedin"
  | "mailchimp";
