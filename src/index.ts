#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Octokit } from "@octokit/rest";
import { z } from "zod";

// GitHub Pages response interface
interface GitHubPagesResponse {
  html_url?: string;
  source?: {
    branch: string;
    path: string;
  };
  build_type?: string;
  cname?: string | null;
}

// Tool input schemas
const EnableGithubPagesSchema = z.object({
  owner: z.string().describe("Repository owner (username or organization)"),
  repo: z.string().describe("Repository name"),
  source: z.object({
    branch: z.string().describe("Branch to deploy from (e.g., 'main', 'gh-pages')"),
    path: z.enum(["/", "/docs"]).optional().describe("Path to deploy from ('/' or '/docs')"),
  }),
  build_type: z.enum(["legacy", "workflow"]).optional().describe("Build type: 'legacy' or 'workflow'"),
});

const GetGithubPagesInfoSchema = z.object({
  owner: z.string().describe("Repository owner (username or organization)"),
  repo: z.string().describe("Repository name"),
});

const DeployToGithubPagesSchema = z.object({
  owner: z.string().describe("Repository owner (username or organization)"),
  repo: z.string().describe("Repository name"),
  branch: z.string().describe("Branch to deploy from"),
  message: z.string().optional().describe("Commit message"),
  files: z.array(z.object({
    path: z.string().describe("File path in the repository"),
    content: z.string().describe("File content (can be base64 encoded for binary files)"),
    encoding: z.enum(["utf-8", "base64"]).optional().describe("Content encoding"),
  })).optional().describe("Files to deploy"),
});

const DisableGithubPagesSchema = z.object({
  owner: z.string().describe("Repository owner (username or organization)"),
  repo: z.string().describe("Repository name"),
});

const UpdateGithubPagesConfigSchema = z.object({
  owner: z.string().describe("Repository owner (username or organization)"),
  repo: z.string().describe("Repository name"),
  source: z.object({
    branch: z.string().describe("Branch to deploy from"),
    path: z.enum(["/", "/docs"]).optional().describe("Path to deploy from"),
  }).optional(),
  build_type: z.enum(["legacy", "workflow"]).optional().describe("Build type"),
  cname: z.string().optional().describe("Custom domain name"),
});

class GitHubPagesMCPServer {
  private server: Server;
  private octokit: Octokit;

  constructor() {
    this.server = new Server(
      {
        name: "github-pages-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize Octokit with auth token from environment
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error("Warning: GITHUB_TOKEN environment variable not set. GitHub API calls will fail without authentication.");
    }
    
    this.octokit = new Octokit({
      auth: token,
    });

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "enable_github_pages":
            return await this.enableGithubPages(args);
          case "get_github_pages_info":
            return await this.getGithubPagesInfo(args);
          case "deploy_to_github_pages":
            return await this.deployToGithubPages(args);
          case "disable_github_pages":
            return await this.disableGithubPages(args);
          case "update_github_pages_config":
            return await this.updateGithubPagesConfig(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(
            `Invalid arguments: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
          );
        }
        throw error;
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: "enable_github_pages",
        description:
          "Enable GitHub Pages for a repository. Creates or updates the GitHub Pages configuration with specified source branch and build settings.",
        inputSchema: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description: "Repository owner (username or organization)",
            },
            repo: {
              type: "string",
              description: "Repository name",
            },
            source: {
              type: "object",
              properties: {
                branch: {
                  type: "string",
                  description: "Branch to deploy from (e.g., 'main', 'gh-pages')",
                },
                path: {
                  type: "string",
                  enum: ["/", "/docs"],
                  description: "Path to deploy from ('/' or '/docs')",
                },
              },
              required: ["branch"],
            },
            build_type: {
              type: "string",
              enum: ["legacy", "workflow"],
              description: "Build type: 'legacy' for Jekyll or 'workflow' for GitHub Actions",
            },
          },
          required: ["owner", "repo", "source"],
        },
      },
      {
        name: "get_github_pages_info",
        description:
          "Get the current GitHub Pages configuration and deployment status for a repository. Returns information about the Pages site URL, build status, source configuration, and custom domain if configured.",
        inputSchema: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description: "Repository owner (username or organization)",
            },
            repo: {
              type: "string",
              description: "Repository name",
            },
          },
          required: ["owner", "repo"],
        },
      },
      {
        name: "deploy_to_github_pages",
        description:
          "Deploy files to GitHub Pages by creating commits on the specified branch. This tool allows you to push content directly to the Pages branch. Note: The branch must exist and GitHub Pages must be enabled for the repository.",
        inputSchema: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description: "Repository owner (username or organization)",
            },
            repo: {
              type: "string",
              description: "Repository name",
            },
            branch: {
              type: "string",
              description: "Branch to deploy to (must match GitHub Pages source branch)",
            },
            message: {
              type: "string",
              description: "Commit message for the deployment",
            },
            files: {
              type: "array",
              description: "Files to deploy",
              items: {
                type: "object",
                properties: {
                  path: {
                    type: "string",
                    description: "File path in the repository",
                  },
                  content: {
                    type: "string",
                    description: "File content (can be base64 encoded for binary files)",
                  },
                  encoding: {
                    type: "string",
                    enum: ["utf-8", "base64"],
                    description: "Content encoding (default: utf-8)",
                  },
                },
                required: ["path", "content"],
              },
            },
          },
          required: ["owner", "repo", "branch"],
        },
      },
      {
        name: "disable_github_pages",
        description:
          "Disable GitHub Pages for a repository. This will take down the published site and remove the GitHub Pages configuration. The repository content remains unchanged.",
        inputSchema: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description: "Repository owner (username or organization)",
            },
            repo: {
              type: "string",
              description: "Repository name",
            },
          },
          required: ["owner", "repo"],
        },
      },
      {
        name: "update_github_pages_config",
        description:
          "Update the GitHub Pages configuration for a repository. This allows you to change the source branch, path, build type, or custom domain settings without disabling and re-enabling Pages.",
        inputSchema: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description: "Repository owner (username or organization)",
            },
            repo: {
              type: "string",
              description: "Repository name",
            },
            source: {
              type: "object",
              properties: {
                branch: {
                  type: "string",
                  description: "Branch to deploy from",
                },
                path: {
                  type: "string",
                  enum: ["/", "/docs"],
                  description: "Path to deploy from",
                },
              },
              required: ["branch"],
            },
            build_type: {
              type: "string",
              enum: ["legacy", "workflow"],
              description: "Build type: 'legacy' or 'workflow'",
            },
            cname: {
              type: "string",
              description: "Custom domain name (e.g., 'example.com')",
            },
          },
          required: ["owner", "repo"],
        },
      },
    ];
  }

  private async enableGithubPages(args: unknown) {
    const { owner, repo, source, build_type } = EnableGithubPagesSchema.parse(args);

    try {
      const response = await this.octokit.repos.createPagesSite({
        owner,
        repo,
        source: {
          branch: source.branch,
          path: source.path || "/",
        },
        build_type: build_type || "legacy",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: "GitHub Pages enabled successfully",
                url: response.data.html_url,
                source: response.data.source,
                build_type: response.data.build_type,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: error.message,
                details: error.response?.data || "Unknown error",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  private async getGithubPagesInfo(args: unknown) {
    const { owner, repo } = GetGithubPagesInfoSchema.parse(args);

    try {
      const response = await this.octokit.repos.getPages({
        owner,
        repo,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                url: response.data.html_url,
                status: response.data.status,
                cname: response.data.cname,
                custom_404: response.data.custom_404,
                source: response.data.source,
                build_type: response.data.build_type,
                public: response.data.public,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      if (error.status === 404) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: "GitHub Pages is not enabled for this repository",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: error.message,
                details: error.response?.data || "Unknown error",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  private async deployToGithubPages(args: unknown) {
    const { owner, repo, branch, message, files } = DeployToGithubPagesSchema.parse(args);

    try {
      if (!files || files.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: "No files provided for deployment",
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      // Get the reference to the branch
      const refResponse = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });

      const latestCommitSha = refResponse.data.object.sha;

      // Get the latest commit to get the tree SHA
      const commitResponse = await this.octokit.git.getCommit({
        owner,
        repo,
        commit_sha: latestCommitSha,
      });

      const baseTreeSha = commitResponse.data.tree.sha;

      // Create blobs for each file
      const treeItems = await Promise.all(
        files.map(async (file) => {
          const encoding = file.encoding === "base64" ? "base64" : "utf-8";
          const blobResponse = await this.octokit.git.createBlob({
            owner,
            repo,
            content: file.content,
            encoding: encoding,
          });

          return {
            path: file.path,
            mode: "100644" as const,
            type: "blob" as const,
            sha: blobResponse.data.sha,
          };
        })
      );

      // Create a new tree
      const treeResponse = await this.octokit.git.createTree({
        owner,
        repo,
        tree: treeItems,
        base_tree: baseTreeSha,
      });

      // Create a new commit
      const newCommitResponse = await this.octokit.git.createCommit({
        owner,
        repo,
        message: message || "Deploy to GitHub Pages",
        tree: treeResponse.data.sha,
        parents: [latestCommitSha],
      });

      // Update the reference
      await this.octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommitResponse.data.sha,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: "Files deployed successfully",
                commit_sha: newCommitResponse.data.sha,
                files_deployed: files.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: error.message,
                details: error.response?.data || "Unknown error",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  private async disableGithubPages(args: unknown) {
    const { owner, repo } = DisableGithubPagesSchema.parse(args);

    try {
      await this.octokit.repos.deletePagesSite({
        owner,
        repo,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: "GitHub Pages disabled successfully",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: error.message,
                details: error.response?.data || "Unknown error",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  private async updateGithubPagesConfig(args: unknown) {
    const { owner, repo, source, build_type, cname } = UpdateGithubPagesConfigSchema.parse(args);

    try {
      const updateParams: {
        owner: string;
        repo: string;
        source?: { branch: string; path: "/" | "/docs" };
        build_type?: "legacy" | "workflow";
        cname?: string | null;
      } = {
        owner,
        repo,
      };

      if (source) {
        const path = source.path || "/";
        if (path !== "/" && path !== "/docs") {
          throw new Error("Invalid path: must be '/' or '/docs'");
        }
        updateParams.source = {
          branch: source.branch,
          path: path,
        };
      }

      if (build_type) {
        updateParams.build_type = build_type;
      }

      if (cname !== undefined) {
        updateParams.cname = cname;
      }

      const response = await this.octokit.repos.updateInformationAboutPagesSite(updateParams);
      const data = response.data as GitHubPagesResponse;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: "GitHub Pages configuration updated successfully",
                url: data.html_url,
                source: data.source,
                build_type: data.build_type,
                cname: data.cname,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: error.message,
                details: error.response?.data || "Unknown error",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("GitHub Pages MCP Server running on stdio");
  }
}

// Start the server
const server = new GitHubPagesMCPServer();
server.run().catch(console.error);
