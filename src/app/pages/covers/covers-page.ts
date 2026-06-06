import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideArrowRight, LucideCheck, LucideHeart, LucideStar } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { SerieSummary } from '../../core/models';
import { OnboardingService } from '../../core/onboarding.service';
import { SeriesService } from '../../core/series.service';
import { resolvePosterUrl } from '../../core/poster-url';

@Component({
  selector: 'app-covers-page',
  imports: [CommonModule, LucideArrowRight, LucideCheck, LucideHeart, LucideStar],
  templateUrl: './covers-page.html'
})
export class CoversPage implements OnInit {
  readonly covers = signal<SerieSummary[]>([]);
  readonly selectedIds = signal<number[]>([]);
  readonly saving = signal(false);
  readonly loading = signal(true);

  constructor(
    private readonly onboarding: OnboardingService,
    private readonly seriesService: SeriesService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      let recommended: SerieSummary[] = [];
      try {
        recommended = await firstValueFrom(this.seriesService.getRecomendaciones());
      } catch (e) {
        console.warn('No se pudieron obtener recomendaciones, usando fallback.');
      }

      const userGenres = this.onboarding.ensureGenres();
      const genreSearches: SerieSummary[] = [];

      if (userGenres.length > 0) {
        const queries = userGenres.map(g => g.queries[Math.floor(Math.random() * g.queries.length)]);
        
        const searchPromises = queries.map(q => 
          firstValueFrom(this.seriesService.searchSeries(q)).catch(() => [])
        );
        const results = await Promise.all(searchPromises);
        results.forEach(res => genreSearches.push(...res));
      }
      const combined = [...recommended, ...genreSearches];
      const uniqueSeries = this.uniqueSeries(combined);
      const withPosters = uniqueSeries.filter(s => resolvePosterUrl(s.poster) !== null);
      const shuffled = withPosters.sort(() => Math.random() - 0.5);
      this.covers.set(shuffled.slice(0, 18));

    } finally {
      this.loading.set(false);
    }
  }

  private uniqueSeries(items: SerieSummary[]): SerieSummary[] {
    const seen = new Set<number>();
    return items.filter(item => {
      if (seen.has(item.id_tmdb)) return false;
      seen.add(item.id_tmdb);
      return true;
    });
  }

  select(serie: SerieSummary): void {
    const selected = this.isSelected(serie.id_tmdb);
    const next = selected
      ? this.selectedIds().filter((id) => id !== serie.id_tmdb)
      : [...this.selectedIds(), serie.id_tmdb];

    this.selectedIds.set(next);
  }

  isSelected(idTmdb: number): boolean {
    return this.selectedIds().includes(idTmdb);
  }

  async finish(): Promise<void> {
    this.saving.set(true);
    try {
      const selected = new Set(this.selectedIds());
      for (const serie of this.covers().filter((item) => selected.has(item.id_tmdb))) {
        await this.onboarding.recordInteraction(serie, 'LE_GUSTA');
      }

      await this.router.navigate(['/browse']);
    } finally {
      this.saving.set(false);
    }
  }
}