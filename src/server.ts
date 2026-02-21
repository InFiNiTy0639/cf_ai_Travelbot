import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import {
    streamText,
    convertToModelMessages,
    pruneMessages,
    tool,
    stepCountIs,
    type StreamTextOnFinishCallback,
    type ToolSet,
} from "ai";
import { z } from "zod";

// Types
interface TripPlan {
    destination: string;
    days: number;
    itinerary: string[];
    savedAt: string;
}

interface AgentState {
    preferences: {
        budget: string;
        interests: string[];
        travelStyle: string;
    } | null;
    savedTrips: TripPlan[];
}

// chat agent
export class ChatAgent extends AIChatAgent<Env, AgentState> {
    initialState: AgentState = {
        preferences: null,
        savedTrips: [],
    };

    onStart() {
        // Create table for storing trip summaries on first run
        this.sql`CREATE TABLE IF NOT EXISTS trip_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destination TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`;
    }

    async onChatMessage(
        onFinish: StreamTextOnFinishCallback<ToolSet>,
        options?: { abortSignal?: AbortSignal },
    ) {
        const workersai = createWorkersAI({ binding: this.env.AI });

        // Build context from saved state
        const stateContext = this.state?.preferences
            ? `\nUser preferences: Budget=${this.state.preferences.budget}, Interests=${this.state.preferences.interests.join(", ")}, Style=${this.state.preferences.travelStyle}`
            : "";

        const savedTripsContext =
            this.state?.savedTrips?.length > 0
                ? `\nPreviously saved trips: ${this.state.savedTrips.map((t) => `${t.destination} (${t.days} days)`).join(", ")}`
                : "";

        // Get trip history from SQL
        const history =
            this.sql<{ destination: string; summary: string }>`SELECT destination, summary FROM trip_history ORDER BY created_at DESC LIMIT 5`;
        const historyContext =
            history.length > 0
                ? `\nRecent trip history: ${history.map((h) => `${h.destination}: ${h.summary}`).join("; ")}`
                : "";

        const result = streamText({
            model: workersai("@cf/zai-org/glm-4.7-flash"),
            system:
                `You are TravelBot 🌍 — a friendly, knowledgeable AI travel planner.

IMPORTANT: You have access to tools (functions) that you MUST call to complete tasks. Do NOT write out tool calls as JSON text — instead, invoke them directly using the function calling mechanism. When a user asks about weather, call the getWeather tool. When they want an itinerary, call the createItinerary tool. When booking is needed, call the bookActivity tool.

You help users plan amazing trips by:
- Checking weather conditions using the getWeather tool
- Creating detailed day-by-day itineraries using the createItinerary tool
- Getting user travel preferences using the getUserPreferences tool
- Helping book activities (with user approval) using the bookActivity tool

After receiving tool results, summarize them in a friendly, engaging way with emojis. Be enthusiastic, specific, and give practical advice.
When suggesting itineraries, be creative and include a mix of popular attractions and hidden gems.
${stateContext}${savedTripsContext}${historyContext}`,
            messages: pruneMessages({
                messages: await convertToModelMessages(this.messages),
                toolCalls: "before-last-2-messages",
            }),
            tools: {
                // Server-side tool: Weather check 
                getWeather: tool({
                    description:
                        "Get the current weather forecast for a travel destination. Use this when the user asks about weather conditions at a location.",
                    inputSchema: z.object({
                        city: z.string().describe("City name to check weather for"),
                        country: z
                            .string()
                            .optional()
                            .describe("Country name for clarity"),
                    }),
                    execute: async ({ city, country }) => {
                        // Simulated weather API (replace with real API in production)
                        const conditions = [
                            { desc: "Sunny ☀️", icon: "☀️", tip: "Pack sunscreen and sunglasses!" },
                            { desc: "Partly Cloudy ⛅", icon: "⛅", tip: "Light layers recommended." },
                            { desc: "Rainy 🌧️", icon: "🌧️", tip: "Bring a waterproof jacket and umbrella." },
                            { desc: "Clear Skies 🌤️", icon: "🌤️", tip: "Perfect sightseeing weather!" },
                            { desc: "Overcast ☁️", icon: "☁️", tip: "Comfortable for walking tours." },
                        ];
                        const temp = Math.floor(Math.random() * 25) + 10;
                        const humidity = Math.floor(Math.random() * 40) + 40;
                        const selected =
                            conditions[Math.floor(Math.random() * conditions.length)];
                        return {
                            city,
                            country: country || "Unknown",
                            temperature: `${temp}°C (${Math.round(temp * 1.8 + 32)}°F)`,
                            condition: selected.desc,
                            humidity: `${humidity}%`,
                            travelTip: selected.tip,
                            bestTimeToVisit: "Check the seasonal guide for optimal timing.",
                        };
                    },
                }),

                // Server-side tool: Create itinerary 
                createItinerary: tool({
                    description:
                        "Create a detailed day-by-day travel itinerary for a destination. Use when the user asks to plan a trip or wants an itinerary.",
                    inputSchema: z.object({
                        destination: z
                            .string()
                            .describe("Travel destination city or region"),
                        days: z
                            .number()
                            .min(1)
                            .max(14)
                            .describe("Number of days for the trip"),
                        interests: z
                            .array(z.string())
                            .optional()
                            .describe(
                                "User interests like food, history, adventure, culture, etc."
                            ),
                    }),
                    execute: async ({ destination, days, interests }) => {
                        const interestList = interests || [
                            "sightseeing",
                            "local cuisine",
                            "culture",
                        ];

                        // Generate activity suggestions based on interests
                        const activityTemplates: Record<string, string[]> = {
                            food: [
                                "Street food tour of local markets",
                                "Cooking class with local chef",
                                "Fine dining experience at top-rated restaurant",
                                "Food hall exploration and tasting",
                                "Visit local farm or vineyard",
                            ],
                            history: [
                                "Guided tour of historic monuments",
                                "Visit to national museum",
                                "Walking tour of old town quarter",
                                "Archaeological site exploration",
                                "Historical documentary screening at local cinema",
                            ],
                            adventure: [
                                "Hiking trail with panoramic views",
                                "Water sports or boat tour",
                                "Cycling tour through scenic routes",
                                "Zip-lining or rock climbing",
                                "Wildlife safari or nature walk",
                            ],
                            culture: [
                                "Traditional performance or theater show",
                                "Local art gallery visit",
                                "Temple or religious site tour",
                                "Handicraft workshop",
                                "Evening cultural festival",
                            ],
                            sightseeing: [
                                "Visit iconic landmarks",
                                "Scenic viewpoint at sunset",
                                "Hop-on hop-off bus tour",
                                "Photography walk through bohemian districts",
                                "River cruise or harbor tour",
                            ],
                            "local cuisine": [
                                "Breakfast at beloved local café",
                                "Lunch at a hidden gem restaurant",
                                "Evening food market exploration",
                                "Traditional dinner experience",
                                "Dessert tasting tour",
                            ],
                        };

                        const itinerary: string[] = [];
                        for (let day = 1; day <= days; day++) {
                            const activities: string[] = [];
                            for (const interest of interestList) {
                                const templates =
                                    activityTemplates[interest.toLowerCase()] ||
                                    activityTemplates["sightseeing"];
                                const activity =
                                    templates[Math.floor(Math.random() * templates.length)];
                                activities.push(activity);
                            }
                            itinerary.push(
                                `Day ${day}: ${activities.slice(0, 3).join(" → ")}`
                            );
                        }

                        // Save to agent state
                        const newTrip: TripPlan = {
                            destination,
                            days,
                            itinerary,
                            savedAt: new Date().toISOString(),
                        };
                        this.setState({
                            ...this.state,
                            savedTrips: [...(this.state?.savedTrips || []), newTrip],
                        });

                        // Save to SQL history
                        const summary = `${days}-day trip focused on ${interestList.join(", ")}`;
                        this.sql`INSERT INTO trip_history (destination, summary) VALUES (${destination}, ${summary})`;

                        return {
                            destination,
                            duration: `${days} days`,
                            focusAreas: interestList,
                            itinerary,
                            estimatedBudget: `$${days * 150}-$${days * 300} (depending on preferences)`,
                            tip: "This itinerary can be customized — just ask me to adjust any day!",
                        };
                    },
                }),

                // Client-side tool: Get user preferences
                getUserPreferences: tool({
                    description:
                        "Get the user's travel preferences from their browser. Use this when you need to personalize recommendations.",
                    inputSchema: z.object({}),
                }),

                //Approval-gated tool: Book activity
                bookActivity: tool({
                    description:
                        "Book a travel activity or experience. Requires user approval before proceeding. Use when the user wants to book something specific.",
                    inputSchema: z.object({
                        activity: z.string().describe("Name of the activity to book"),
                        destination: z.string().describe("Where the activity takes place"),
                        date: z
                            .string()
                            .describe("Preferred date (e.g., 'March 15, 2026')"),
                        estimatedCost: z
                            .string()
                            .describe("Estimated cost of the activity"),
                        participants: z
                            .number()
                            .default(1)
                            .describe("Number of participants"),
                    }),
                    needsApproval: async () => true, // Always require approval for bookings
                    execute: async ({
                        activity,
                        destination,
                        date,
                        estimatedCost,
                        participants,
                    }) => {
                        // Simulated booking (replace with a real booking API)
                        const confirmationId = `TB-${Date.now().toString(36).toUpperCase()}`;
                        return {
                            status: "✅ Booking Confirmed!",
                            confirmationId,
                            activity,
                            destination,
                            date,
                            estimatedCost,
                            participants,
                            note: "This is a demo booking. In production, this would connect to a real booking service.",
                        };
                    },
                }),
            },
            onFinish,
            stopWhen: stepCountIs(5),
            abortSignal: options?.abortSignal,
        });

        return result.toUIMessageStreamResponse();
    }
}

// Worker Entry Point
export default {
    async fetch(request: Request, env: Env) {
        return (
            (await routeAgentRequest(request, env)) ||
            new Response("Not found", { status: 404 })
        );
    },
} satisfies ExportedHandler<Env>;
