package service

import (
	"time"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

func ListPrompts(q model.Query) (model.PromptList, error) {
	items, total, err := repository.ListPrompts(q)
	if err != nil {
		return model.PromptList{}, err
	}
	tags, err := repository.ListPromptTags(q)
	if err != nil {
		return model.PromptList{}, err
	}
	var categories []string
	if q.Scope == "gallery" {
		// 画廊模式：保证筛选栏始终具有画廊范围内的完整分类与标签，不会因关键词过滤而导致筛选项消失
		galleryQuery := model.Query{Scope: "gallery"}
		if galleryTags, err := repository.ListPromptTags(galleryQuery); err == nil && len(galleryTags) > 0 {
			tags = galleryTags
		}
		if allGalleryItems, _, err := repository.ListPrompts(model.Query{Scope: "gallery", PageSize: 500}); err == nil {
			allCats := promptCategoriesFromItems(allGalleryItems)
			if len(allCats) > 0 {
				categories = allCats
			}
		}
		if len(categories) == 0 {
			categories = promptCategoriesFromItems(items)
		}
		if len(categories) == 0 {
			categories = []string{"人物写真", "潮流时装摄影", "商业摄影", "电影海报"}
		}
	} else {
		categories = promptCategoryCodes(ListPromptCategories())
	}
	return model.PromptList{Items: items, Tags: tags, Categories: categories, Total: int(total)}, nil
}

func promptCategoriesFromItems(items []model.Prompt) []string {
	seen := map[string]bool{}
	var categories []string
	for _, item := range items {
		if item.Category != "" && !seen[item.Category] {
			seen[item.Category] = true
			categories = append(categories, item.Category)
		}
	}
	return categories
}

func ListPromptCategories() []model.PromptCategory {
	categories, _ := repository.ListPromptCategories()
	return categories
}

func SavePrompt(item model.Prompt) (model.Prompt, error) {
	now := time.Now().Format(time.RFC3339)
	if item.Category == "" {
		item.Category = repository.PromptCategories()[0].Category
	}
	if item.ID == "" {
		item.ID = newID(item.Category)
		item.CreatedAt = now
	}
	item.UpdatedAt = now

	item.GithubURL = ""
	return repository.SavePrompt(item)
}

func DeletePrompt(id string) error {
	return repository.DeletePrompt(id)
}

func DeletePrompts(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	return repository.DeletePrompts(ids)
}

func promptCategoryCodes(items []model.PromptCategory) []string {
	codes := []string{}
	for _, item := range items {
		if item.Category != "" {
			codes = append(codes, item.Category)
		}
	}
	return codes
}
