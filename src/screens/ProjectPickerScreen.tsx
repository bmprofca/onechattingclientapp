import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {Project} from '../api/auth';
import {useTheme} from '../theme/theme';

export function ProjectPickerScreen({projects, onSelect}: {projects: Project[]; onSelect: (projectId: string) => void}) {
  const theme = useTheme();

  return (
    <View style={[styles.safe, {backgroundColor: theme.canvas}]}>
      <FlatList
        data={projects}
        keyExtractor={project => project.id}
        contentContainerStyle={styles.page}
        ListHeaderComponent={
          <>
            <View style={[styles.logo, {backgroundColor: theme.mint}]}>
              <Text style={[styles.logoText, {color: theme.mintText}]}>1</Text>
            </View>
            <Text style={[styles.eyebrow, {color: theme.mintText}]}>SELECT WORKSPACE</Text>
            <Text style={[styles.title, {color: theme.ink}]}>Choose a project</Text>
            <Text style={[styles.copy, {color: theme.muted}]}>Pick the WhatsApp workspace you want to manage.</Text>
          </>
        }
        renderItem={({item}) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => onSelect(item.id)}
            style={({pressed}) => [
              styles.card,
              {backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow},
              pressed && {backgroundColor: theme.cardHover},
            ]}
          >
            <View style={[styles.icon, {backgroundColor: theme.mint}]}>
              <Text style={[styles.iconText, {color: theme.mintText}]}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.cardText}>
              <Text numberOfLines={1} style={[styles.name, {color: theme.ink}]}>{item.name}</Text>
              <Text style={[styles.meta, {color: theme.muted}]}>{item.owned ? 'Owned by you' : item.ownerName || 'Shared workspace'}</Text>
            </View>
            <Text style={[styles.arrow, {color: theme.mintText}]}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  page: {padding: 22, paddingBottom: 32},
  logo: {width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  logoText: {fontSize: 25, fontWeight: '900'},
  eyebrow: {fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginTop: 37},
  title: {fontSize: 30, fontWeight: '800', letterSpacing: -.7, marginTop: 8},
  copy: {fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 18},
  card: {minHeight: 76, borderWidth: 1, borderRadius: 18, marginTop: 10, padding: 14, flexDirection: 'row', alignItems: 'center', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: {width: 0, height: 3}},
  icon: {width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  iconText: {fontWeight: '900', fontSize: 17},
  cardText: {flex: 1, marginLeft: 12},
  name: {fontSize: 15, fontWeight: '800'},
  meta: {fontSize: 12, marginTop: 4},
  arrow: {fontSize: 28},
});