
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';

import type { Content, CreateContentInput, MembershipLevel } from '../../../server/src/schema';

interface ContentSectionProps {
  userId: number;
  isAdmin: boolean;
}

export function ContentSection({ userId, isAdmin }: ContentSectionProps) {
  const [content, setContent] = useState<Content[]>([]);
  const [membershipLevels, setMembershipLevels] = useState<MembershipLevel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const [newContent, setNewContent] = useState<CreateContentInput>({
    title: '',
    description: null,
    content_type: 'article',
    content_url: null,
    content_body: null,
    required_membership_level_id: null,
    is_published: false
  });

  const loadContent = useCallback(async () => {
    setIsLoading(true);
    try {
      const [contentData, levels] = await Promise.all([
        trpc.getContent.query({ userId: isAdmin ? undefined : userId }),
        trpc.getMembershipLevels.query()
      ]);
      
      setContent(contentData);
      setMembershipLevels(levels);
      setError(null);
    } catch (err) {
      console.error('Failed to load content:', err);
      setError('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.title.trim()) {
      setError('Title is required');
      return;
    }

    setIsLoading(true);
    try {
      const createdContent = await trpc.createContent.mutate(newContent);
      setContent((prev: Content[]) => [createdContent, ...prev]);
      setNewContent({
        title: '',
        description: null,
        content_type: 'article',
        content_url: null,
        content_body: null,
        required_membership_level_id: null,
        is_published: false
      });
      setIsCreateDialogOpen(false);
      setError(null);
    } catch (err) {
      console.error('Failed to create content:', err);
      setError('Failed to create content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteContent = async (contentId: number) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    setIsLoading(true);
    try {
      await trpc.deleteContent.mutate({ id: contentId });
      setContent((prev: Content[]) => prev.filter((c: Content) => c.id !== contentId));
      setError(null);
    } catch (err) {
      console.error('Failed to delete content:', err);
      setError('Failed to delete content');
    } finally {
      setIsLoading(false);
    }
  };

  const getContentTypeIcon = (type: string): string => {
    switch (type) {
      case 'article': return '📄';
      case 'video': return '🎥';
      case 'course': return '🎓';
      case 'download': return '📁';
      default: return '📄';
    }
  };

  const getContentTypeColor = (type: string): string => {
    switch (type) {
      case 'article': return 'bg-blue-100 text-blue-700';
      case 'video': return 'bg-red-100 text-red-700';
      case 'course': return 'bg-green-100 text-green-700';
      case 'download': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredContent = content.filter((item: Content) => {
    if (filter === 'all') return true;
    return item.content_type === filter;
  });

  const getMembershipLevelName = (levelId: number | null): string => {
    if (!levelId) return 'Free';
    const level = membershipLevels.find((l: MembershipLevel) => l.id === levelId);
    return level ? level.name : 'Unknown';
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">📚 Content Library</h2>
          <p className="text-gray-600">
            {isAdmin ? 'Manage all platform content' : 'Access your available content'}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>+ Create Content</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Content</DialogTitle>
                <DialogDescription>
                  Add new content to the platform
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateContent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newContent.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewContent((prev: CreateContentInput) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Content title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newContent.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setNewContent((prev: CreateContentInput) => ({ 
                        ...prev, 
                        description: e.target.value || null 
                      }))
                    }
                    placeholder="Brief description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="content_type">Content Type</Label>
                    <Select
                      value={newContent.content_type}
                      onValueChange={(value: 'article' | 'video' | 'course' | 'download') =>
                        setNewContent((prev: CreateContentInput) => ({ ...prev, content_type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="article">📄 Article</SelectItem>
                        <SelectItem value="video">🎥 Video</SelectItem>
                        <SelectItem value="course">🎓 Course</SelectItem>
                        <SelectItem value="download">📁 Download</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="membership_level">Required Membership</Label>
                    <Select
                      value={newContent.required_membership_level_id?.toString() || 'free'}
                      onValueChange={(value: string) =>
                        setNewContent((prev: CreateContentInput) => ({ 
                          ...prev, 
                          required_membership_level_id: value === 'free' ? null : parseInt(value)
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select membership level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free Access</SelectItem>
                        {membershipLevels.map((level: MembershipLevel) => (
                          <SelectItem key={level.id} value={level.id.toString()}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content_url">Content URL (Optional)</Label>
                  <Input
                    id="content_url"
                    type="url"
                    value={newContent.content_url || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewContent((prev: CreateContentInput) => ({ 
                        ...prev, 
                        content_url: e.target.value || null 
                      }))
                    }
                    placeholder="https://example.com/content"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content_body">Content Body</Label>
                  <Textarea
                    id="content_body"
                    value={newContent.content_body || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setNewContent((prev: CreateContentInput) => ({ 
                        ...prev, 
                        content_body: e.target.value || null 
                      }))
                    }
                    placeholder="Main content text"
                    rows={6}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_published"
                    checked={newContent.is_published}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewContent((prev: CreateContentInput) => ({ ...prev, is_published: e.target.checked }))
                    }
                  />
                  <Label htmlFor="is_published">Publish immediately</Label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create Content'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All Content
        </Button>
        <Button
          variant={filter === 'article' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('article')}
        >
          📄 Articles
        </Button>
        <Button
          variant={filter === 'video' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('video')}
        >
          🎥 Videos
        </Button>
        <Button
          variant={filter === 'course' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('course')}
        >
          🎓 Courses
        </Button>
        <Button
          variant={filter === 'download' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('download')}
        >
          📁 Downloads
        </Button>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredContent.map((item: Content) => (
          <Card key={item.id} className="h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getContentTypeIcon(item.content_type)}</span>
                  <div>
                    <CardTitle className="text-lg line-clamp-2">{item.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getContentTypeColor(item.content_type)}>
                        {item.content_type}
                      </Badge>
                      <Badge variant="outline">
                        {getMembershipLevelName(item.required_membership_level_id)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Badge variant={item.is_published ? 'default' : 'secondary'}>
                  {item.is_published ? 'Published' : 'Draft'}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {item.description && (
                <CardDescription className="line-clamp-3">
                  {item.description}
                </CardDescription>
              )}

              <div className="text-sm text-gray-500">
                Created: {item.created_at.toLocaleDateString()}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button size="sm" className="flex-1">
                  {item.content_type === 'download' ? 'Download' : 'View'}
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteContent(item.id)}
                    disabled={isLoading}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredContent.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-lg font-semibold mb-2">No Content Available</h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'No content has been created yet.'
                : `No ${filter} content available.`}
            </p>
            {isAdmin && (
              <Button 
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                Create First Content
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
